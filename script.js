let currentAudio = null;
let lastAudioData = null; // Store the last audio for replay

function loadHistory() {
    fetch('/history')
        .then(response => response.json())
        .then(history => {
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML = '';
            history.forEach((msg, index) => {
                addMessage(msg.role, msg.content, msg.audio, index);
            });
        })
        .catch(error => console.error('Error loading history:', error));
}

function addMessage(role, content, audio = null, index = null) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `p-4 my-2 rounded-lg max-w-2xl ${role === 'user' ? 'bg-teal-600' : 'bg-gray-700'}`;
    
    if (role === 'assistant') {
        // Format assistant response as structured bullet points
        const ul = document.createElement('ul');
        ul.className = 'list-disc pl-5 space-y-2';
        content.split('\n').forEach(line => {
            if (line.trim().startsWith('-')) {
                const li = document.createElement('li');
                li.textContent = line.trim().substring(1).trim();
                ul.appendChild(li);
            } else if (line.trim()) {
                const li = document.createElement('li');
                li.textContent = line.trim();
                ul.appendChild(li);
            }
        });
        messageDiv.appendChild(ul);

        // Add Play button for this specific message if audio exists
        if (audio) {
            const playButton = document.createElement('button');
            playButton.textContent = 'Play';
            playButton.className = 'mt-2 py-1 px-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm';
            playButton.onclick = () => playSpecificAudio(audio);
            messageDiv.appendChild(playButton);
        }
    } else {
        messageDiv.textContent = content; // User message as plain text
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}

function replayAudio() {
    if (lastAudioData) {
        stopAudio(); // Stop any playing audio first
        currentAudio = new Audio(`data:audio/mp3;base64,${lastAudioData}`);
        currentAudio.play();
    }
}

function playSpecificAudio(audioData) {
    stopAudio(); // Stop any playing audio
    currentAudio = new Audio(`data:audio/mp3;base64,${audioData}`);
    currentAudio.play();
}

function sendMessage() {
    const input = document.getElementById('user-input');
    const prompt = input.value.trim();
    if (!prompt) return;

    // Stop any playing audio
    stopAudio();

    addMessage('user', prompt);
    input.value = '';

    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        if (data.error) {
            addMessage('assistant', `Error: ${data.error}`);
        } else {
            console.log('Assistant response:', data.response); // Debug log
            addMessage('assistant', data.response, data.audio);
            if (data.audio) {
                lastAudioData = data.audio; // Store for replay
                currentAudio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                currentAudio.play();
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        addMessage('assistant', 'Error: Something went wrong while fetching the response.');
    });
}

function updateSettings() {
    const settings = {
        behavior: document.getElementById('behavior').value,
        expertise: document.getElementById('expertise').value,
        voice_enabled: document.getElementById('voice-enabled').checked
    };

    fetch('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => console.log(data.status))
    .catch(error => console.error('Error updating settings:', error));
}

// Load history on page load
window.onload = loadHistory;

// Send message on Enter key
document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});