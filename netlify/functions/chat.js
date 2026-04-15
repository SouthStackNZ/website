(function() {
  var history = [];
  var isLoading = false;

  var toggle = document.getElementById('ss-chat-toggle');
  var panel = document.getElementById('ss-chat-panel');
  var messages = document.getElementById('ss-chat-messages');
  var input = document.getElementById('ss-chat-input');
  var sendBtn = document.getElementById('ss-chat-send');

  toggle.addEventListener('click', function() {
    var isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      toggle.classList.remove('open');
    } else {
      panel.classList.add('open');
      toggle.classList.add('open');
      input.focus();
    }
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  function addMessage(text, role) {
    var div = document.createElement('div');
    div.className = 'ss-msg ' + (role === 'user' ? 'ss-msg-user' : 'ss-msg-bot');
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function setLoading(state) {
    isLoading = state;
    sendBtn.disabled = state;
    input.disabled = state;
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    addMessage(text, 'user');
    history.push({ role: 'user', content: text });

    setLoading(true);
    var typingDiv = document.createElement('div');
    typingDiv.className = 'ss-msg ss-msg-typing';
    typingDiv.textContent = 'Thinking…';
    messages.appendChild(typingDiv);
    messages.scrollTop = messages.scrollHeight;

    try {
      var response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });

      var data = await response.json();
      typingDiv.remove();

      var replyText = '';
      if (data.content && data.content[0] && data.content[0].text) {
        replyText = data.content[0].text;
      } else {
        replyText = 'Sorry, something went wrong. Please email hello@southstack.co.nz or use the contact form.';
      }

      history.push({ role: 'assistant', content: replyText });
      addMessage(replyText, 'bot');
    } catch (err) {
      typingDiv.remove();
      addMessage('Sorry, I could not connect. Please email hello@southstack.co.nz or use the contact form.', 'bot');
    }

    setLoading(false);
    input.focus();
  }
})();