// ── State ──────────────────────────────────────────────
const state = {
  diet: { lifestyle: [], allergies: [], other: '' },
  goals: [],
  householdSize: 2,
  currentTab: 'chat',
  currentDay: 0,
  groceryItems: [
    { name: 'Spinach', sub: 'Click to pick a product', status: 'pending' },
    { name: 'Brown rice', sub: 'Mahatma Jasmine Brown Rice, Thai Fragrant Whole Grain Rice, 2 lb Bag $3.22', status: 'selected' },
    { name: 'Olive oil', sub: 'Click to pick a product', status: 'pending' },
    { name: 'Garlic', sub: 'Click to pick a product', status: 'pending' },
    { name: 'Chicken', sub: 'Perdue Fresh No Antibiotics Ever Thin Sliced Chicken Breasts, 0.85–1.6 lbs $6.54', status: 'selected' },
  ],
  meals: {
    0: [
      { type: 'BREAKFAST', name: 'Greek yogurt with berries', meta: '320 cal | 28g protein | $3.20', liked: true },
      { type: 'LUNCH', name: 'Chicken spinach salad', meta: '480 cal | 30g protein | $5.00', liked: false },
      { type: 'DINNER', name: 'Veggie stir fry with rice', meta: '610 cal | 25g protein | $6.50', liked: false },
    ],
    1: [
      { type: 'BREAKFAST', name: 'Oatmeal with banana', meta: '280 cal | 10g protein | $1.50', liked: false },
      { type: 'LUNCH', name: 'Turkey wrap', meta: '420 cal | 28g protein | $4.50', liked: false },
      { type: 'DINNER', name: 'Salmon with veggies', meta: '520 cal | 38g protein | $8.00', liked: false },
    ],
  },
  chatMessages: [
    { role: 'bot', text: 'Hi! I\'m Plately, your nutrition assistant. Ask me anything about your cart or meal plan.' }
  ]
};

const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];

// ── Step navigation ─────────────────────────────────────
function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Pill toggle ─────────────────────────────────────────
function setupPills() {
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('selected');
    });
  });
}

// ── Household stepper ───────────────────────────────────
function setupStepper() {
  document.getElementById('decrementHH').addEventListener('click', () => {
    if (state.householdSize > 1) {
      state.householdSize--;
      document.getElementById('hhCount').textContent = state.householdSize;
    }
  });
  document.getElementById('incrementHH').addEventListener('click', () => {
    state.householdSize++;
    document.getElementById('hhCount').textContent = state.householdSize;
  });
}

// ── Tab switching ───────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentTab = btn.dataset.tab;
      renderTab(state.currentTab);
    });
  });
}

function renderTab(tab) {
  const content = document.getElementById('tabContent');
  if (tab === 'chat') renderChat(content);
  else if (tab === 'list') renderGrocery(content);
  else if (tab === 'meals') renderMeals(content);
  else if (tab === 'saved') renderSaved(content);
  else if (tab === 'profile') renderProfile(content);
}

// ── CHAT ────────────────────────────────────────────────
function renderChat(el) {
  el.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-messages" id="chatMessages">${state.chatMessages.map(m => `
        <div class="chat-bubble ${m.role}">${m.text}</div>
      `).join('')}</div>
      <div class="chat-input-row">
        <input class="chat-input" id="chatInput" placeholder="Ask about your cart..." />
        <button class="chat-send" id="chatSend">
          <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;

  const input = el.querySelector('#chatInput');
  const send = el.querySelector('#chatSend');
  const msgs = el.querySelector('#chatMessages');

  function sendMsg() {
    const text = input.value.trim();
    if (!text) return;
    state.chatMessages.push({ role: 'user', text });
    input.value = '';
    renderTab('chat');
    // Simulate bot response
    setTimeout(() => {
      state.chatMessages.push({ role: 'bot', text: 'Great question! Let me check your cart and meal plan for you.' });
      renderTab('chat');
    }, 800);
  }

  send.addEventListener('click', sendMsg);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

  // Scroll to bottom
  msgs.scrollTop = msgs.scrollHeight;
}

// ── GROCERY ─────────────────────────────────────────────
function renderGrocery(el) {
  const pending = state.groceryItems.filter(i => i.status === 'pending').length;
  el.innerHTML = `
    <div class="grocery-wrap">
      ${pending > 0 ? `
        <div class="alert-banner">
          ${pending} items need a product selected
          <span>Tap any item below to choose.</span>
        </div>` : `
        <div class="alert-banner" style="background:#d4edda;color:#1a5c2a;">
          All ${state.groceryItems.length} items have products selected
          <span style="color:#2a7a3e;">Ready to add directly to your Walmart cart.</span>
        </div>`}
      <div class="grocery-list">
        ${state.groceryItems.map((item, i) => `
          <div class="grocery-item" data-index="${i}">
            <div class="item-dot ${item.status}"></div>
            <div class="item-info">
              <div class="item-name">${item.name}</div>
              <div class="item-sub">${item.sub}</div>
            </div>
            ${item.status === 'pending'
              ? `<div class="item-arrow">›</div>`
              : `<div class="item-check checked"></div>`}
          </div>
        `).join('')}
      </div>
      <div class="grocery-footer">
        <button class="btn-full" id="addCartBtn">
          ${pending > 0 ? `Add to cart | ${pending} items pending` : 'Add all to cart'}
        </button>
      </div>
    </div>
  `;

  el.querySelectorAll('.grocery-item').forEach(row => {
    row.addEventListener('click', () => {
      const i = parseInt(row.dataset.index);
      if (state.groceryItems[i].status === 'pending') {
        state.groceryItems[i].status = 'selected';
        state.groceryItems[i].sub = 'Bertolli Extra Virgin Olive Oil, Rich Taste $8.47';
        renderGrocery(el);
      }
    });
  });
}

// ── MEALS ───────────────────────────────────────────────
function renderMeals(el) {
  const today = state.currentDay;
  const meals = state.meals[today] || state.meals[0];

  el.innerHTML = `
    <div class="meals-wrap">
      <div class="day-tabs">
        ${days.map((d, i) => `
          <button class="day-tab ${i === today ? 'active' : ''}" data-day="${i}">
            <span>${d}</span>
            <span class="day-num">${i + 1}</span>
          </button>
        `).join('')}
      </div>
      <div class="meal-cards">
        ${meals.map((m, mi) => `
          <div class="meal-card">
            <div class="meal-card-info">
              <div class="meal-type">${m.type}</div>
              <div class="meal-name">${m.name}</div>
              <div class="meal-meta">${m.meta}</div>
            </div>
            <button class="heart-btn ${m.liked ? 'liked' : ''}" data-day="${today}" data-meal="${mi}">
              ${m.liked ? '♥' : '♡'}
            </button>
          </div>
        `).join('')}
      </div>
      <div class="regen-bar">
        <button class="btn-full">Regenerate with AI ✦</button>
      </div>
    </div>
  `;

  el.querySelectorAll('.day-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentDay = parseInt(btn.dataset.day);
      renderMeals(el);
    });
  });

  el.querySelectorAll('.heart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.day);
      const mi = parseInt(btn.dataset.meal);
      const dayMeals = state.meals[d] || state.meals[0];
      dayMeals[mi].liked = !dayMeals[mi].liked;
      renderMeals(el);
    });
  });
}

// ── SAVED ───────────────────────────────────────────────
function renderSaved(el) {
  const saved = [];
  Object.values(state.meals).forEach(dayMeals => {
    dayMeals.forEach(m => { if (m.liked) saved.push(m); });
  });

  el.innerHTML = `
    <div style="padding:14px 12px;">
      <h3 style="font-size:15px;color:#1a2e22;margin-bottom:12px;">Saved Meals</h3>
      ${saved.length === 0
        ? `<p style="color:#9aada0;font-size:13px;">No saved meals yet. Tap ♡ on a meal to save it.</p>`
        : saved.map(m => `
          <div class="meal-card" style="margin-bottom:8px;">
            <div class="meal-card-info">
              <div class="meal-type">${m.type}</div>
              <div class="meal-name">${m.name}</div>
              <div class="meal-meta">${m.meta}</div>
            </div>
            <span style="font-size:18px;color:#d5825f;">♥</span>
          </div>
        `).join('')}
    </div>
  `;
}

// ── PROFILE ─────────────────────────────────────────────
function renderProfile(el) {
  el.innerHTML = `
    <div class="profile-wrap">
      <div class="profile-avatar-row">
        <div class="avatar"></div>
        <div class="profile-name">Mary Jane</div>
      </div>

      <div class="profile-section">
        <div class="profile-section-label">DIETARY RESTRICTIONS</div>
        <div class="profile-box">
          <span class="tag-pill">Gluten-free</span>
          <button class="add-btn">+ Add</button>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-label">HEALTH GOALS</div>
        <div class="profile-box">
          <span class="tag-pill">Gain muscle</span>
          <button class="add-btn">+ Add</button>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-label">HOUSEHOLD SIZE</div>
        <div class="profile-box">
          <div class="hh-stepper">
            <span class="hh-label">People</span>
            <button class="stepper-btn" id="profileDecrement">−</button>
            <span id="profileHH">${state.householdSize}</span>
            <button class="stepper-btn" id="profileIncrement">+</button>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-label">WEEKLY TARGETS</div>
        <div class="profile-box" style="flex-direction:column;gap:4px;">
          <div class="target-row"><span>Budget</span><span class="target-val">$120/week</span></div>
          <div class="target-row"><span>Calories</span><span class="target-val">1,800/day</span></div>
        </div>
      </div>

      <button class="signout-btn">Sign out</button>
    </div>
  `;

  el.querySelector('#profileDecrement').addEventListener('click', () => {
    if (state.householdSize > 1) {
      state.householdSize--;
      el.querySelector('#profileHH').textContent = state.householdSize;
    }
  });
  el.querySelector('#profileIncrement').addEventListener('click', () => {
    state.householdSize++;
    el.querySelector('#profileHH').textContent = state.householdSize;
  });
}

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupPills();
  setupStepper();
  setupTabs();

  document.getElementById('startBtn').addEventListener('click', () => showStep('step-diet'));
  document.getElementById('dietNextBtn').addEventListener('click', () => showStep('step-goals'));
  document.getElementById('goBackBtn').addEventListener('click', () => showStep('step-diet'));
  document.getElementById('finishBtn').addEventListener('click', () => {
    showStep('step-app');
    renderTab('chat');
  });

  // Check if already onboarded
  chrome.storage.local.get(['onboarded'], result => {
    if (result.onboarded) {
      showStep('step-app');
      renderTab('chat');
    }
  });

  document.getElementById('finishBtn').addEventListener('click', () => {
    chrome.storage.local.set({ onboarded: true });
  });
});
