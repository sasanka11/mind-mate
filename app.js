// ============================================
// MindMate - Main Application Logic (COMPLETE FIX)
// ============================================

// Initialize Supabase Client
const { createClient } = window.supabase;
const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);

// Current user state
let currentUser = null;
let currentSessionId = null;
let conversationHistory = [];

// ============================================
// AUTHENTICATION MODULE
// ============================================

async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        window.location.href = 'chat.html';
        return;
    }

    setupAuthForms();
}

function setupAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const loginBtn = document.getElementById('login-btn');

    setButtonLoading(loginBtn, true);

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = 'chat.html';
        }, 1000);

    } catch (error) {
        showAlert(error.message, 'error');
        setButtonLoading(loginBtn, false);
    }
}

async function handleSignup(event) {
    event.preventDefault();

    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const signupBtn = document.getElementById('signup-btn');

    setButtonLoading(signupBtn, true);

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name: name }
            }
        });

        if (error) throw error;

        if (data.user) {
            await supabase
                .from('profiles')
                .update({ name: name })
                .eq('id', data.user.id);
        }

        showAlert('Account created successfully! You can now login.', 'success');

        setTimeout(() => {
            switchTab('login');
            setButtonLoading(signupBtn, false);
        }, 2000);

    } catch (error) {
        showAlert(error.message, 'error');
        setButtonLoading(signupBtn, false);
    }
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'home.html';
}

// ============================================
// CHAT MODULE
// ============================================

async function initChat() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'home.html';
        return;
    }

    currentUser = session.user;

    try {
        await loadOrCreateSession();
        await loadChatHistory();
        await loadMessages();
        scrollToBottom();

        const input = document.getElementById('message-input');
        if (input) input.focus();

    } catch (error) {
        console.error('Error initializing chat:', error);
        showAlert('Chat initialization failed. Please refresh.', 'error');
    }
}

async function loadOrCreateSession() {
    try {
        const { data, error } = await supabase
            .from('conversation_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            currentSessionId = data[0].id;
            const titleEl = document.getElementById('chat-title');
            if (titleEl) {
                titleEl.textContent = data[0].title || '💬 MindMate Chat';
            }
        } else {
            await createNewConversation();
        }
    } catch (error) {
        console.error('Error loading session:', error);
        await createNewConversation();
    }
}

async function createNewConversation() {
    try {
        const { data, error } = await supabase
            .from('conversation_sessions')
            .insert({
                user_id: currentUser.id,
                title: 'New Conversation',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        currentSessionId = data.id;
        conversationHistory = [];

        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="message bot">
                    <div class="message-bubble">
                        <p>Hello! I'm MindMate, your compassionate AI companion. 🌟</p>
                        <p>I'm here to listen and support you. Feel free to share what's on your mind.</p>
                        <div class="message-time">${formatTime(new Date())}</div>
                    </div>
                </div>
            `;
        }

        await loadChatHistory();

        const titleEl = document.getElementById('chat-title');
        if (titleEl) {
            titleEl.textContent = '💬 New Conversation';
        }

    } catch (error) {
        console.error('Error creating new conversation:', error);
    }
}

async function loadChatHistory() {
    try {
        const { data, error } = await supabase
            .from('conversation_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        const todaySessions = [];
        const yesterdaySessions = [];
        const lastWeekSessions = [];

        data.forEach(session => {
            const sessionDate = new Date(session.updated_at || session.created_at);
            sessionDate.setHours(0, 0, 0, 0);

            if (sessionDate.getTime() >= today.getTime()) {
                todaySessions.push(session);
            } else if (sessionDate.getTime() >= yesterday.getTime()) {
                yesterdaySessions.push(session);
            } else if (sessionDate >= lastWeek) {
                lastWeekSessions.push(session);
            }
        });

        const todayCount = document.getElementById('today-count');
        const yesterdayCount = document.getElementById('yesterday-count');
        const lastweekCount = document.getElementById('lastweek-count');

        if (todayCount) todayCount.textContent = todaySessions.length;
        if (yesterdayCount) yesterdayCount.textContent = yesterdaySessions.length;
        if (lastweekCount) lastweekCount.textContent = lastWeekSessions.length;

        populateHistoryItems('today-items', todaySessions);
        populateHistoryItems('yesterday-items', yesterdaySessions);
        populateHistoryItems('lastweek-items', lastWeekSessions);

    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

function populateHistoryItems(containerId, sessions) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'history-item';
        if (session.id === currentSessionId) {
            item.classList.add('active');
        }

        let title = session.title || 'Untitled';
        if (title.length > 30) {
            title = title.substring(0, 30) + '...';
        }

        item.textContent = title;
        item.onclick = () => loadSession(session.id, session.title);
        container.appendChild(item);
    });
}

async function loadSession(sessionId, title) {
    if (sessionId === currentSessionId) return;

    currentSessionId = sessionId;
    conversationHistory = [];

    const titleEl = document.getElementById('chat-title');
    if (titleEl) {
        titleEl.textContent = title || '💬 MindMate Chat';
    }

    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }

    await loadMessages();
    await loadChatHistory();
    scrollToBottom();
}

async function loadMessages() {
    if (!currentSessionId) return;

    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('session_id', currentSessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        conversationHistory = [];

        if (!data || data.length === 0) {
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div class="message bot">
                        <div class="message-bubble">
                            <p>Hello! I'm MindMate, your compassionate AI companion. 🌟</p>
                            <p>I'm here to listen and support you. Feel free to share what's on your mind.</p>
                            <div class="message-time">${formatTime(new Date())}</div>
                        </div>
                    </div>
                `;
            }
            return;
        }

        data.forEach(msg => {
            appendMessage(msg.content, msg.sender, new Date(msg.created_at));
            conversationHistory.push({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });

        scrollToBottom();

    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// ============================================
// SEND MESSAGE - MAIN FUNCTION
// ============================================

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();

    if (!message) return;

    const sendBtn = document.getElementById('send-btn');

    // Disable input
    input.disabled = true;
    sendBtn.disabled = true;
    setButtonLoading(sendBtn, true);

    // Display user message
    appendMessage(message, 'user', new Date());

    // Add to history
    conversationHistory.push({
        role: 'user',
        parts: [{ text: message }]
    });

    // Save user message
    await saveMessage(message, 'user');

    // Clear input
    input.value = '';

    // Show typing indicator
    showTypingIndicator();

    // Get AI response
    try {
        console.log('🚀 Sending message to AI:', message);

        const analysis = await analyzeWithPerplexity(message);

        console.log('✅ AI Response received:', analysis);

        // Hide typing indicator
        hideTypingIndicator();

        // Display bot response
        appendMessage(analysis.reply, 'bot', new Date(), analysis);

        // Add to history
        conversationHistory.push({
            role: 'model',
            parts: [{ text: analysis.reply }]
        });

        // Save bot message
        await saveMessage(analysis.reply, 'bot');

        // Save emotion log
        await saveEmotionLog(analysis);

        // Update session title if needed
        await updateSessionTitleIfNeeded(message);

        // Check for crisis
        if (analysis.risk_score >= CONFIG.app.crisisThreshold) {
            await handleCrisisDetection(analysis, message);
        }

    } catch (error) {
        console.error('❌ Error in sendMessage:', error);
        hideTypingIndicator();
        appendMessage('I apologize, but I encountered an error. Please try again. 💙', 'bot', new Date());
    }

    // Re-enable input
    input.disabled = false;
    sendBtn.disabled = false;
    setButtonLoading(sendBtn, false);
    input.focus();
    scrollToBottom();
}

// ============================================
// GEMINI AI API - FIXED VERSION
// ============================================

async function analyzeWithPerplexity(message) {

    // Build conversation context
    let messages = [
        {
            role: 'system',
            content: `You are MindMate, a warm and empathetic mental health support chatbot.

Your personality:
- Compassionate, non-judgmental, supportive
- You validate feelings and show genuine care
- You ask thoughtful follow-up questions
- You remember the conversation context

Respond with ONLY valid JSON in this exact format (no other text before or after):
{
    "reply": "Your warm, empathetic response here (2-3 sentences)",
    "primary_emotion": "joy", // one of: joy, sadness, anger, fear, anxiety, neutral, frustration, loneliness, hope
    "intensity": 0.5, // 0.0 to 1.0
    "hidden_emotion": null,
    "risk_score": 0.0, // 0.0 for normal, 0.7-1.0 for self-harm/suicide
    "distortion": null
}

Be conversational and natural, not robotic.`
        }
    ];

    // Add history
    if (conversationHistory.length > 0) {
        // Take last 10 messages for context (Perplexity handles large context well, but let's be safe)
        const recentMessages = conversationHistory.slice(-10);
        recentMessages.forEach(msg => {
            const role = msg.role === 'model' ? 'assistant' : 'user';
            // Extract text from the parts array used in Gemini format
            const text = msg.parts && msg.parts[0] ? msg.parts[0].text : '';
            if (text) {
                messages.push({ role, content: text });
            }
        });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    try {
        console.log('📡 Calling Perplexity API...');

        const response = await fetch(CONFIG.perplexity.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.perplexity.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.perplexity.model,
                messages: messages,
                temperature: 0.2,
                top_p: 0.9,
                return_citations: false,
                search_domain_filter: ["perplexity.ai"],
                return_images: false,
                return_related_questions: false,
                search_recency_filter: "month",
                top_k: 0,
                stream: false,
                presence_penalty: 0,
                frequency_penalty: 1
            })
        });

        console.log('📥 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Full API Response:', data);

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('❌ No valid choices in response');
            throw new Error('No valid response from API');
        }

        const aiText = data.choices[0].message.content;
        console.log('📝 Raw AI text:', aiText);

        // Parse JSON
        return parseAIResponse(aiText, message);

    } catch (error) {
        console.error('❌ analyzeWithPerplexity error:', error);
        return getSmartFallback(message);
    }
}

function parseAIResponse(aiText, originalMessage) {
    try {
        // Clean markdown code blocks
        let cleanText = aiText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();

        // Extract JSON object
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanText = jsonMatch[0];
        }

        console.log('🔧 Parsing JSON:', cleanText);

        const analysis = JSON.parse(cleanText);

        if (!analysis.reply || analysis.reply.length < 3) {
            throw new Error('Invalid reply');
        }

        return {
            reply: analysis.reply,
            primary_emotion: analysis.primary_emotion || 'neutral',
            intensity: parseFloat(analysis.intensity) || 0.5,
            hidden_emotion: analysis.hidden_emotion || null,
            risk_score: parseFloat(analysis.risk_score) || 0,
            distortion: analysis.distortion || null
        };

    } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);

        // Try to extract reply from malformed JSON
        const replyMatch = aiText.match(/"reply"\s*:\s*"([^"]+)"/);
        if (replyMatch && replyMatch[1]) {
            return {
                reply: replyMatch[1],
                primary_emotion: 'neutral',
                intensity: 0.5,
                hidden_emotion: null,
                risk_score: 0,
                distortion: null
            };
        }

        return getSmartFallback(originalMessage);
    }
}

function getSmartFallback(message) {
    const lowerMsg = message.toLowerCase();

    // Positive messages
    if (lowerMsg.match(/good|great|fine|chill|happy|fun|awesome|well|okay|ok\b/)) {
        const responses = [
            "That's wonderful to hear! 😊 What's been making things feel good for you?",
            "I'm glad you're feeling good! 🌟 Anything exciting happening?",
            "That's great! 😊 It's nice to hear you're doing well. What's on your mind?"
        ];
        return {
            reply: responses[Math.floor(Math.random() * responses.length)],
            primary_emotion: 'joy',
            intensity: 0.6,
            hidden_emotion: null,
            risk_score: 0,
            distortion: null
        };
    }

    // Greetings
    if (lowerMsg.match(/^(hi|hello|hey|hola|sup|yo)\b/)) {
        const responses = [
            "Hey there! 👋 How are you doing today?",
            "Hello! 😊 It's great to see you. How's your day going?",
            "Hi! 🌟 What's on your mind today?"
        ];
        return {
            reply: responses[Math.floor(Math.random() * responses.length)],
            primary_emotion: 'neutral',
            intensity: 0.5,
            hidden_emotion: null,
            risk_score: 0,
            distortion: null
        };
    }

    // Sad messages
    if (lowerMsg.match(/sad|down|bad|upset|depressed|lonely|hurt|crying/)) {
        return {
            reply: "I'm sorry you're feeling this way. 💙 Thank you for sharing with me. Would you like to talk about what's going on?",
            primary_emotion: 'sadness',
            intensity: 0.7,
            hidden_emotion: null,
            risk_score: 0,
            distortion: null
        };
    }

    // Stressed messages
    if (lowerMsg.match(/stress|anxious|worried|nervous|overwhelm|panic/)) {
        return {
            reply: "It sounds like you have a lot on your mind. 💙 Take a deep breath. I'm here to listen. What's been causing you the most stress?",
            primary_emotion: 'anxiety',
            intensity: 0.7,
            hidden_emotion: null,
            risk_score: 0,
            distortion: null
        };
    }

    // Default
    return {
        reply: "Thanks for sharing! 😊 Tell me more about what's going on with you today.",
        primary_emotion: 'neutral',
        intensity: 0.5,
        hidden_emotion: null,
        risk_score: 0,
        distortion: null
    };
}

// ============================================
// TYPING INDICATOR
// ============================================

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-bubble">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// ============================================
// SESSION TITLE UPDATE
// ============================================

async function updateSessionTitleIfNeeded(message) {
    try {
        const { data, error } = await supabase
            .from('conversation_sessions')
            .select('title')
            .eq('id', currentSessionId)
            .single();

        if (error) throw error;

        if (data.title === 'New Conversation') {
            let title = message.substring(0, 40);
            if (message.length > 40) title += '...';

            await supabase
                .from('conversation_sessions')
                .update({ title: title, updated_at: new Date().toISOString() })
                .eq('id', currentSessionId);

            const titleEl = document.getElementById('chat-title');
            if (titleEl) titleEl.textContent = `💬 ${title}`;

            await loadChatHistory();
        }
    } catch (error) {
        console.error('Error updating session title:', error);
    }
}

// ============================================
// CRISIS DETECTION
// ============================================

async function handleCrisisDetection(analysis, triggerMessage) {
    try {
        const crisisKeywords = ['suicide', 'kill', 'hurt', 'die', 'end', 'harm', 'death'];
        const keywords = crisisKeywords.filter(kw => triggerMessage.toLowerCase().includes(kw));

        await supabase.from('crisis_logs').insert({
            user_id: currentUser.id,
            risk_score: analysis.risk_score,
            trigger_keywords: keywords,
            action_taken: 'Crisis resources provided'
        });

        setTimeout(() => {
            appendMessage(
                `⚠️ I'm concerned about your safety. Please reach out for help:\n\n` +
                `📞 National Suicide Prevention Lifeline: 988\n` +
                `📱 Crisis Text Line: Text HOME to 741741\n\n` +
                `You're not alone. 💙`,
                'bot',
                new Date()
            );
            scrollToBottom();
        }, 500);

    } catch (error) {
        console.error('Error handling crisis:', error);
    }
}

// ============================================
// DATABASE FUNCTIONS
// ============================================

async function saveMessage(content, sender) {
    if (!currentSessionId || !currentUser) return;

    try {
        await supabase.from('messages').insert({
            user_id: currentUser.id,
            session_id: currentSessionId,
            content: content,
            sender: sender,
            created_at: new Date().toISOString()
        });

        await supabase
            .from('conversation_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', currentSessionId);

    } catch (error) {
        console.error('Error saving message:', error);
    }
}

async function saveEmotionLog(analysis) {
    if (!currentUser) return;

    try {
        await supabase.from('emotion_logs').insert({
            user_id: currentUser.id,
            emotion_type: analysis.primary_emotion,
            intensity_score: analysis.intensity,
            hidden_emotion: analysis.hidden_emotion,
            cognitive_distortion: analysis.distortion,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving emotion log:', error);
    }
}

// ============================================
// UI FUNCTIONS
// ============================================

function appendMessage(content, sender, timestamp, emotionData = null) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const text = document.createElement('p');
    text.innerHTML = content.replace(/\n/g, '<br>');
    bubble.appendChild(text);

    // Emotion badge for bot messages
    if (sender === 'bot' && emotionData && emotionData.primary_emotion && emotionData.primary_emotion !== 'neutral') {
        const badge = document.createElement('div');
        badge.className = `emotion-badge ${emotionData.primary_emotion.toLowerCase()}`;

        let intensityText = emotionData.intensity >= 0.7 ? 'High' : emotionData.intensity >= 0.4 ? 'Medium' : 'Low';

        badge.innerHTML = `<span>Detected: ${capitalizeFirst(emotionData.primary_emotion)} (${intensityText})</span>`;
        bubble.appendChild(badge);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(timestamp);
    bubble.appendChild(time);

    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// DASHBOARD MODULE
// ============================================

async function initDashboard() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'home.html';
        return;
    }

    currentUser = session.user;
    updateGreeting();
    refreshAffirmation();

    try {
        await Promise.all([
            loadDashboardData(),
            loadEmotionPieChart(),
            updateStreakUI(),
            updateProgressTracker()
        ]);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

async function loadDashboardData() {
    try {
        const { data: emotions } = await supabase
            .from('emotion_logs')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        const { data: crises } = await supabase
            .from('crisis_logs')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        updateStatistics(emotions || []);
        createEmotionChart(emotions || []);
        displayCrisisAlerts(crises || []);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateStatistics(emotions) {
    const totalEl = document.getElementById('total-conversations');
    if (totalEl) totalEl.textContent = emotions.length;

    const emotionCounts = {};
    emotions.forEach(e => {
        if (e.emotion_type) {
            emotionCounts[e.emotion_type] = (emotionCounts[e.emotion_type] || 0) + 1;
        }
    });

    let mostCommon = '-';
    if (Object.keys(emotionCounts).length > 0) {
        mostCommon = Object.keys(emotionCounts).reduce((a, b) =>
            emotionCounts[a] > emotionCounts[b] ? a : b
        );
        mostCommon = capitalizeFirst(mostCommon);
    }

    const commonEl = document.getElementById('common-emotion');
    if (commonEl) commonEl.textContent = mostCommon;

    const oneWeekAgo = getWeekAgo();
    const thisWeek = emotions.filter(e => new Date(e.created_at) > oneWeekAgo).length;
    const weekEl = document.getElementById('this-week');
    if (weekEl) weekEl.textContent = thisWeek;
}

function createEmotionChart(emotions) {
    const ctx = document.getElementById('emotion-chart');
    if (!ctx) return;

    const emotionCounts = {};
    emotions.forEach(e => {
        if (e.emotion_type) {
            emotionCounts[e.emotion_type] = (emotionCounts[e.emotion_type] || 0) + 1;
        }
    });

    if (Object.keys(emotionCounts).length === 0) {
        emotionCounts['No data'] = 1;
    }

    const labels = Object.keys(emotionCounts).map(l => capitalizeFirst(l));
    const data = Object.values(emotionCounts);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency',
                data: data,
                backgroundColor: 'rgba(110, 198, 202, 0.7)',
                borderColor: 'rgba(110, 198, 202, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: { legend: { display: false } }
        }
    });
}

function displayCrisisAlerts(crises) {
    if (!crises || crises.length === 0) return;

    const container = document.getElementById('crisis-alerts-container');
    const list = document.getElementById('crisis-alerts-list');
    if (!container || !list) return;

    container.style.display = 'block';

    crises.slice(0, 5).forEach(crisis => {
        const item = document.createElement('div');
        item.className = 'crisis-item';

        const riskLevel = crisis.risk_score >= 0.9 ? 'Critical' :
            crisis.risk_score >= 0.7 ? 'High' : 'Moderate';

        item.innerHTML = `
            <p><strong>Risk:</strong> ${riskLevel} (${(crisis.risk_score * 100).toFixed(0)}%)</p>
            <p><strong>Date:</strong> ${formatDate(new Date(crisis.created_at))}</p>
        `;
        list.appendChild(item);
    });
}

async function updateStreakUI() {
    if (!currentUser) return;

    try {
        const { data } = await supabase
            .from('mood_journal')
            .select('created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (data && data.length > 0) {
            const checkedDays = new Set();
            data.forEach(entry => {
                const entryDate = new Date(entry.created_at);
                entryDate.setHours(0, 0, 0, 0);
                checkedDays.add(entryDate.getTime());
            });

            let checkDate = new Date(today);
            while (checkedDays.has(checkDate.getTime())) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
        }

        const streakEl = document.getElementById('streak-count');
        const messageEl = document.getElementById('streak-message');

        if (streakEl) streakEl.textContent = streak;
        if (messageEl) {
            if (streak >= 7) messageEl.textContent = '🎉 One week streak!';
            else if (streak >= 3) messageEl.textContent = '💪 Great start!';
            else if (streak >= 1) messageEl.textContent = '✨ Keep it up!';
            else messageEl.textContent = 'Log your mood to start!';
        }
    } catch (error) {
        console.error('Error updating streak:', error);
    }
}

async function updateProgressTracker() {
    if (!currentUser) return;

    try {
        const { data } = await supabase
            .from('crisis_logs')
            .select('created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1);

        const daysSinceEl = document.getElementById('days-since-crisis');
        const progressBar = document.getElementById('progress-bar');
        const progressMessageEl = document.getElementById('progress-message');

        if (data && data.length > 0) {
            const lastCrisis = new Date(data[0].created_at);
            const diffDays = Math.ceil(Math.abs(new Date() - lastCrisis) / (1000 * 60 * 60 * 24));

            if (daysSinceEl) daysSinceEl.textContent = diffDays;
            if (progressBar) progressBar.style.width = `${Math.min((diffDays / 30) * 100, 100)}%`;
            if (progressMessageEl) progressMessageEl.textContent = 'You\'re making great progress!';
        } else {
            if (daysSinceEl) daysSinceEl.textContent = '∞';
            if (progressBar) progressBar.style.width = '100%';
            if (progressMessageEl) progressMessageEl.textContent = '✨ No crisis alerts!';
        }
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

async function loadEmotionPieChart() {
    if (!currentUser) return;

    try {
        const { data } = await supabase
            .from('emotion_logs')
            .select('emotion_type')
            .eq('user_id', currentUser.id)
            .gte('created_at', getWeekAgo().toISOString());

        const ctx = document.getElementById('emotion-pie-chart');
        if (!ctx) return;

        const emotionCounts = {};
        if (data && data.length > 0) {
            data.forEach(log => {
                const emotion = log.emotion_type || 'neutral';
                emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            });
        } else {
            emotionCounts['No data'] = 1;
        }

        const colors = {
            'joy': '#FFD93D', 'sadness': '#7FA2D9', 'anger': '#FF6B6B',
            'anxiety': '#FF9B85', 'neutral': '#A0AEC0', 'fear': '#9B87E8',
            'No data': '#E0E0E0'
        };

        const labels = Object.keys(emotionCounts);
        const values = Object.values(emotionCounts);
        const backgroundColors = labels.map(l => colors[l.toLowerCase()] || '#A0AEC0');

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => capitalizeFirst(l)),
                datasets: [{ data: values, backgroundColor: backgroundColors, borderWidth: 2, borderColor: '#fff' }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });

    } catch (error) {
        console.error('Error loading pie chart:', error);
    }
}

const affirmations = [
    "You are doing your best, and that is enough.",
    "You are strong, capable, and resilient.",
    "Your feelings are valid, and you matter.",
    "This too shall pass.",
    "You deserve compassion, especially from yourself.",
    "Every day is a new opportunity.",
    "Progress, not perfection."
];

function updateGreeting() {
    const greetingEl = document.getElementById('user-greeting');
    if (!greetingEl || !currentUser) return;

    const hour = new Date().getHours();
    let greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = currentUser.user_metadata?.name || 'Friend';
    greetingEl.textContent = `${greeting}, ${name} 👋`;
}

function refreshAffirmation() {
    const affirmationEl = document.getElementById('affirmation');
    if (!affirmationEl) return;

    const randomIndex = Math.floor(Math.random() * affirmations.length);
    affirmationEl.textContent = `"${affirmations[randomIndex]}"`;
}

async function saveMood(emoji, moodName) {
    if (!currentUser) return;

    const statusEl = document.getElementById('mood-status');
    if (statusEl) statusEl.textContent = 'Saving...';

    try {
        await supabase.from('mood_journal').insert({
            user_id: currentUser.id,
            mood_emoji: emoji,
            mood_name: moodName,
            created_at: new Date().toISOString()
        });

        if (statusEl) statusEl.textContent = `✓ Logged: ${emoji}`;
        await updateStreakUI();
        await loadEmotionPieChart();

    } catch (error) {
        console.error('Error saving mood:', error);
        if (statusEl) statusEl.textContent = '✗ Failed';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getWeekAgo() {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0);
    return date;
}

function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    if (!container) return console.log(`Alert (${type}):`, message);

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    container.innerHTML = '';
    container.appendChild(alert);

    setTimeout(() => alert.remove(), 5000);
}

function setButtonLoading(button, isLoading) {
    if (!button) return;

    const span = button.querySelector('span');

    if (isLoading) {
        button.disabled = true;
        if (span) span.textContent = '';
        const loader = document.createElement('div');
        loader.className = 'loading';
        button.appendChild(loader);
    } else {
        button.disabled = false;
        const loader = button.querySelector('.loading');
        if (loader) loader.remove();

        if (span) {
            if (button.id === 'login-btn') span.textContent = 'Login';
            if (button.id === 'signup-btn') span.textContent = 'Sign Up';
            if (button.id === 'send-btn') span.textContent = 'Send';
        }
    }
}

function formatTime(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
}