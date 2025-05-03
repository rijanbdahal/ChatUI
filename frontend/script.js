const inputForm = document.getElementById("inputForm");
const recordButton = document.getElementById("audioInput");
const userInputField = document.getElementById("userInput");
const chatLogs = document.getElementById("chatLogs");
const deleteChatButton = document.getElementById("deleteChatButton");

let messageLogs = JSON.parse(localStorage.getItem("messageLogs")) || [];
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let stream;


loadChatLogs();


deleteChatButton.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the chat?")) {
    messageLogs = [];
    localStorage.removeItem("messageLogs");
    loadChatLogs();
  }
});

recordButton.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!isRecording) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm; codecs=opus' });

      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

          
          stream.getTracks().forEach(track => track.stop());
          audioChunks = [];

          removeIndicator("listening-indicator");
          addIndicator("typing-indicator", "typing...");

          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const res = await fetch('http://localhost:5000/audio', {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error('Server error');

          const data = await res.json();

          messageLogs.push({ role: 'user', message: data.transcription });
          messageLogs.push({ role: 'ai', message: data.message });

        } catch (err) {
          console.error(err);
          messageLogs.push({ role: "ai", message: "Error: Failed to get audio response from server." });
        } finally {
          localStorage.setItem("messageLogs", JSON.stringify(messageLogs));
          loadChatLogs();
          removeIndicator("typing-indicator");
          isRecording = false;
          recordButton.textContent = "🎤 Start";
        }
      };

      mediaRecorder.start();
      isRecording = true;
      recordButton.textContent = "🛑 Stop";
      addIndicator("listening-indicator", "🎙 Listening...");

    } catch (err) {
      console.error(err);
      alert("Could not access microphone.");
    }

  } else {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }
});

inputForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = userInputField.value.trim();
  if (!message) return;

  messageLogs.push({ role: "user", message });
  loadChatLogs();
  userInputField.value = "";

  addIndicator("typing-indicator", "typing...");

  try {
    const res = await fetch("http://localhost:5000/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) throw new Error('Server error');

    const data = await res.json();
    messageLogs.push({ role: "ai", message: data.message });

  } catch (err) {
    console.error(err);
    messageLogs.push({ role: "ai", message: "Error: Failed to connect to server." });

  } finally {
    localStorage.setItem("messageLogs", JSON.stringify(messageLogs));
    loadChatLogs();
    removeIndicator("typing-indicator");
  }
});

function createMessageElement(role, message) {
  const container = document.createElement("div");
  container.classList.add("chat-message", role);

  const img = document.createElement("img");
  img.className = "profile-pic";
  img.src = role === "user"
    ? "./images/user.jpg"
    : "./images/image_processing20220331-25868-33f17n.gif";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = message;

  container.appendChild(img);
  container.appendChild(bubble);

  return container;
}


function loadChatLogs() {
  chatLogs.innerHTML = "";
  messageLogs.forEach(({ role, message }) => {
    const msgEl = createMessageElement(role, message);
    chatLogs.appendChild(msgEl);
  });
  chatLogs.scrollTop = chatLogs.scrollHeight;
}

function addIndicator(id, text) {
  removeIndicator(id); 
  const indicator = document.createElement("div");
  indicator.id = id;
  indicator.className = "status-indicator";
  indicator.textContent = text;
  chatLogs.appendChild(indicator);
  chatLogs.scrollTop = chatLogs.scrollHeight;
}

function removeIndicator(id) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
}

window.addEventListener("DOMContentLoaded", loadChatLogs);
