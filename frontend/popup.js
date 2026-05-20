// ── State ──────────────────────────────────────────────
const state = {
  diet: { lifestyle: [], allergies: [], other: '' },
  goals: [],
  householdSize: 2,
  weeklyBudget: 120,
  dailyCalories: 1800,
  profileDietTags: ['Gluten-free'],
  profileGoalTags: ['Gain muscle'],
  profileName: 'Mary Jane',
  profilePhoto: null,
  profileEditing: false,
  currentTab: 'chat',
  currentDay: 0,
  groceryItems: [],
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
  savedMeals: { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] },
  savedSearch: '',
  savedFilter: 'All',
  chatMessages: [
    { role: 'bot', text: "Hi! I'm Simplate, your nutrition assistant. Ask me anything about your cart or meal plan." }
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

// ── Format recipe for display ───────────────────────────
function formatRecipe(recipe) {
  const ingredients = recipe.ingredients
    .map(i => `• ${i.quantity} ${i.name}`)
    .join('\n');
  return `🍽️ ${recipe.recipe_name}\n${recipe.description}\n\nIngredients:\n${ingredients}`;
}

// ── CHAT (our backend version) ───────────────────────────
function renderChat(el) {
  el.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-messages" id="chatMessages">${state.chatMessages.map(m => `
        <div class="chat-bubble ${m.role}">${m.text.replace(/\n/g, '<br>')}</div>
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

  async function sendMsg() {
    const text = input.value.trim();
    if (!text) return;
    state.chatMessages.push({ role: 'user', text });
    input.value = '';
    renderTab('chat');

    try {
      const res = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: state.chatMessages.map(m => ({
            role: m.role === 'bot' ? 'assistant' : 'user',
            content: m.text
          })),
          dietary_restrictions: state.diet.lifestyle.concat(state.diet.allergies),
          health_goals: state.goals
        })
      });
      const data = await res.json();

      if (data.recipe && data.recipe.ingredients) {
        state.chatMessages.push({ role: 'bot', text: formatRecipe(data.recipe) });
        state.groceryItems = data.recipe.ingredients.map(ing => ({
          name: ing.name,
          sub: 'Click to pick a product',
          status: 'pending',
          itemId: null
        }));
      } else {
        state.chatMessages.push({ role: 'bot', text: data.reply || data.error || 'No response received.' });
      }
    } catch (e) {
      state.chatMessages.push({ role: 'bot', text: 'Error: could not reach backend. Is it running?' });
    }

    renderTab('chat');
  }

  send.addEventListener('click', sendMsg);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
  msgs.scrollTop = msgs.scrollHeight;
}

// ── WALMART SEARCH (via backend Playwright scraper) ──────
async function searchWalmart(query, maxResults = 5) {
  const res = await fetch(`http://localhost:5000/search?ingredient=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.results || [];
}

// ── GROCERY (our backend version) ────────────────────────
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
    row.addEventListener('click', async () => {
      const i = parseInt(row.dataset.index);
      const item = state.groceryItems[i];
      const name = item.name;

      item.sub = 'Searching...';
      renderGrocery(el);

      try {
        const results = await searchWalmart(name);
        if (results.length > 0) {
          showProductPicker(name, results, i, el);
        } else {
          item.sub = 'No products found';
          renderGrocery(el);
        }
      } catch (e) {
        item.sub = 'Error fetching product';
        renderGrocery(el);
      }
    });
  });

  el.querySelector('#addCartBtn').addEventListener('click', async () => {
    const selected = state.groceryItems.filter(i => i.status === 'selected' && i.itemId);
    if (selected.length === 0) {
      alert('No products selected yet. Click each item to pick a product first.');
      return;
    }

    // Only items with a known product URL can be auto-added
    const urls = selected.map(i => i.productUrl).filter(Boolean);
    if (urls.length === 0) {
      alert('Product URLs not available. Try re-selecting your items.');
      return;
    }

    // Show loading state on button
    const btn = el.querySelector('#addCartBtn');
    btn.disabled = true;
    btn.textContent = `Adding ${urls.length} item${urls.length > 1 ? 's' : ''} to cart…`;

    chrome.runtime.sendMessage({ type: 'simplate_start_atc', urls }, (response) => {
      btn.disabled = false;
      btn.textContent = response?.added > 0
        ? `✓ Added ${response.added} item${response.added > 1 ? 's' : ''} — cart opening…`
        : 'Add all to cart';
      setTimeout(() => {
        btn.textContent = selected.length > 0 ? 'Add all to cart' : `Add to cart | ${selected.length} pending`;
      }, 3000);
    });
  });
}

// ── PRODUCT PICKER MODAL ─────────────────────────────────
function showProductPicker(ingredientName, products, itemIndex, groceryEl) {
  document.getElementById('productPickerModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'productPickerModal';
  modal.className = 'cat-modal-overlay';
  modal.innerHTML = `
    <div class="cat-modal product-picker-modal">
      <div class="cat-modal-title">Choose a product</div>
      <div class="cat-modal-meal">${ingredientName}</div>
      <div class="product-picker-list" id="productPickerList">
        ${products.map((p, i) => `
          <button class="product-picker-item" data-index="${i}">
            ${p.image ? `<img class="product-thumb" src="${p.image}" alt="" />` : '<div class="product-thumb-placeholder">🛒</div>'}
            <div class="product-picker-info">
              <div class="product-picker-name">${p.name}</div>
              <div class="product-picker-price">${p.price != null ? p.price : 'Price N/A'}</div>
            </div>
            <div class="product-picker-check">›</div>
          </button>
        `).join('')}
      </div>
      <button class="cat-modal-cancel" id="productPickerCancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll('.product-picker-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = products[parseInt(btn.dataset.index)];
      state.groceryItems[itemIndex].status = 'selected';
      state.groceryItems[itemIndex].sub = `${p.name}${p.price != null ? ' ' + p.price : ''}`;
      state.groceryItems[itemIndex].itemId = p.id;
      state.groceryItems[itemIndex].productUrl = p.url;
      modal.remove();
      renderGrocery(groceryEl);
    });
  });

  modal.querySelector('#productPickerCancel').addEventListener('click', () => {
    state.groceryItems[itemIndex].sub = 'Click to pick a product';
    modal.remove();
    renderGrocery(groceryEl);
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      state.groceryItems[itemIndex].sub = 'Click to pick a product';
      modal.remove();
      renderGrocery(groceryEl);
    }
  });
}

// ── MEALS ─────────────────────────────────────────────────
// selectedDate tracks which real calendar date is selected
// We store it as { year, month (0-indexed), day }
function getTodayObj() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

if (!state.selectedDate) state.selectedDate = getTodayObj();

// Build a day-key string like "2025-6-14" to key into state.meals
function dateKey(y, m, d) { return `${y}-${m}-${d}`; }

// Get meals for a date, falling back to default meals[0]
function getMealsForDate(y, m, d) {
  const key = dateKey(y, m, d);
  const todayObj = getTodayObj();
  const todayKey = dateKey(todayObj.year, todayObj.month, todayObj.day);
  // Map existing meals[0] to today and meals[1] to tomorrow for demo
  if (key === todayKey) return state.meals[0];
  const tomorrow = new Date(todayObj.year, todayObj.month, todayObj.day + 1);
  const tomorrowKey = dateKey(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  if (key === tomorrowKey && state.meals[1]) return state.meals[1];
  return state.meals[0];
}

function renderMeals(el) {
  const today = getTodayObj();
  const sel = state.selectedDate;
  const meals = getMealsForDate(sel.year, sel.month, sel.day);

  // Build 7-day strip starting from today
  const stripDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.year, today.month, today.day + i);
    stripDays.push({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
  }

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Format selected date label
  const selDateObj = new Date(sel.year, sel.month, sel.day);
  const isToday = sel.year === today.year && sel.month === today.month && sel.day === today.day;
  const dateLabel = isToday ? 'Today' : `${dayNames[selDateObj.getDay()]}, ${monthNames[sel.month]} ${sel.day}`;

  el.innerHTML = `
    <div class="meals-wrap">
      <div class="meals-date-bar">
        <span class="meals-date-label">${dateLabel}</span>
        <button class="cal-icon-btn" id="calIconBtn" title="Open calendar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>
      <div class="day-tabs">
        ${stripDays.map(({ year, month, day }) => {
          const d = new Date(year, month, day);
          const isActive = sel.year === year && sel.month === month && sel.day === day;
          return `<button class="day-tab ${isActive ? 'active' : ''}"
            data-year="${year}" data-month="${month}" data-day="${day}">
            <span>${dayNames[d.getDay()]}</span>
            <span class="day-num">${day}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="meal-cards">
        ${meals.map((m, mi) => `
          <div class="meal-card">
            <div class="meal-card-info">
              <div class="meal-type">${m.type}</div>
              <div class="meal-name">${m.name}</div>
              <div class="meal-meta">${m.meta}</div>
            </div>
            <button class="heart-btn ${m.liked ? 'liked' : ''}"
              data-year="${sel.year}" data-month="${sel.month}" data-day="${sel.day}" data-meal="${mi}">
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

  // Day strip clicks
  el.querySelectorAll('.day-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedDate = {
        year: parseInt(btn.dataset.year),
        month: parseInt(btn.dataset.month),
        day: parseInt(btn.dataset.day)
      };
      renderMeals(el);
    });
  });

  // Calendar icon
  el.querySelector('#calIconBtn').addEventListener('click', () => {
    showCalendarDropdown(el);
  });

  // Heart buttons
  el.querySelectorAll('.heart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mi = parseInt(btn.dataset.meal);
      const y = parseInt(btn.dataset.year);
      const m = parseInt(btn.dataset.month);
      const d = parseInt(btn.dataset.day);
      const dayMeals = getMealsForDate(y, m, d);
      const meal = dayMeals[mi];

      if (!meal.liked) {
        showCategoryPicker(meal, (cats) => {
          meal.liked = true;
          meal.savedCategories = cats;
          cats.forEach(cat => {
            if (!state.savedMeals[cat]) state.savedMeals[cat] = [];
            if (!state.savedMeals[cat].find(sm => sm.name === meal.name)) {
              state.savedMeals[cat].push({
                name: meal.name, meta: meal.meta,
                ingredients: meal.ingredients || null,
                instructions: meal.instructions || null,
                description: meal.description || null
              });
            }
          });
          renderMeals(el);
        });
      } else {
        meal.liked = false;
        (meal.savedCategories || []).forEach(cat => {
          if (state.savedMeals[cat])
            state.savedMeals[cat] = state.savedMeals[cat].filter(sm => sm.name !== meal.name);
        });
        meal.savedCategories = [];
        renderMeals(el);
      }
    });
  });
}

// ── CALENDAR DROPDOWN ────────────────────────────────────
function showCalendarDropdown(mealsEl) {
  document.getElementById('calDropdown')?.remove();

  const today = getTodayObj();
  // Calendar view month starts at currently selected date's month
  let viewYear = state.selectedDate.year;
  let viewMonth = state.selectedDate.month;

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function buildCalHTML(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const canGoPrev = true;

    let cells = '';
    // Previous month grey fill
    for (let i = 0; i < firstDay; i++) {
      cells += `<div class="cal-cell other-month">${prevMonthDays - firstDay + 1 + i}</div>`;
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.day && month === today.month && year === today.year;
      const isSelected = d === state.selectedDate.day && month === state.selectedDate.month && year === state.selectedDate.year;
      const isPast = new Date(year, month, d) < new Date(today.year, today.month, today.day);
      let cls = 'cal-cell';
      if (isPast) cls += ' cal-past'; // past days still clickable, just styled differently
      if (isToday) cls += ' cal-today';
      if (isSelected) cls += ' cal-selected';
      cells += `<div class="${cls}" data-year="${year}" data-month="${month}" data-day="${d}">${d}</div>`;
    }
    // Fill remaining cells
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    let nextDay = 1;
    for (let i = firstDay + daysInMonth; i < totalCells; i++) {
      cells += `<div class="cal-cell other-month">${nextDay++}</div>`;
    }

    return `
      <div class="cal-header">
        <button class="cal-nav-btn" id="calPrev" ${canGoPrev ? '' : 'disabled'}>‹</button>
        <span class="cal-month-label">${monthNames[month]} ${year}</span>
        <button class="cal-nav-btn" id="calNext">›</button>
      </div>
      <div class="cal-grid">
        ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
        ${cells}
      </div>
    `;
  }

  const dropdown = document.createElement('div');
  dropdown.id = 'calDropdown';
  dropdown.className = 'cal-dropdown';
  dropdown.innerHTML = buildCalHTML(viewYear, viewMonth);
  document.getElementById('step-app').appendChild(dropdown);

  function rebind() {
    dropdown.querySelector('#calPrev')?.addEventListener('click', () => {
      if (viewYear === today.year && viewMonth === today.month) return;
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      dropdown.innerHTML = buildCalHTML(viewYear, viewMonth);
      rebind();
    });
    dropdown.querySelector('#calNext').addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      dropdown.innerHTML = buildCalHTML(viewYear, viewMonth);
      rebind();
    });
    dropdown.querySelectorAll('.cal-cell[data-day]').forEach(cell => {
      if (cell.classList.contains('other-month')) return;
      cell.addEventListener('click', () => {
        state.selectedDate = {
          year: parseInt(cell.dataset.year),
          month: parseInt(cell.dataset.month),
          day: parseInt(cell.dataset.day)
        };
        dropdown.remove();
        renderMeals(mealsEl);
      });
    });
  }
  rebind();

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!dropdown.contains(e.target) && e.target.id !== 'calIconBtn') {
        dropdown.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 0);
}

// ── SAVED (their version) ────────────────────────────────
const savedCategories = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

function catIcon(cat) {
  return { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙', Snacks: '🍎' }[cat] || '🍽️';
}

function renderSaved(el) {
  const query = state.savedSearch || '';
  const activeFilter = state.savedFilter || 'All';

  el.innerHTML = `
    <div class="saved-wrap">
      <div class="saved-search-row">
        <div class="saved-search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="saved-search-input" id="savedSearchInput" placeholder="Search saved meals..." value="${query}" />
          ${query ? '<button class="saved-search-clear" id="savedSearchClear">×</button>' : ''}
        </div>
      </div>
      <div class="saved-filter-row">
        ${['All', ...savedCategories].map(cat =>
          `<button class="saved-filter-btn ${activeFilter === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>`
        ).join('')}
      </div>
      <div class="saved-list">
        ${savedCategories.map(cat => {
          if (activeFilter !== 'All' && activeFilter !== cat) return '';
          const items = (state.savedMeals[cat] || []).filter(m =>
            m.name.toLowerCase().includes(query.toLowerCase())
          );
          if (items.length === 0 && query) return '';
          return `<div class="saved-section">
            <div class="saved-section-header">
              <span class="saved-section-icon">${catIcon(cat)}</span>
              <span class="saved-section-title">${cat}</span>
              <span class="saved-section-count">${items.length}</span>
            </div>
            ${items.length === 0
              ? `<p class="saved-empty-cat">No saved ${cat.toLowerCase()} yet.</p>`
              : items.map((m, i) => `
                  <div class="saved-item" data-cat="${cat}" data-index="${i}">
                    <div class="saved-item-thumb">${catIcon(cat)}</div>
                    <div class="saved-item-info">
                      <div class="saved-item-name">${m.name}</div>
                      <div class="saved-item-meta">${m.meta}</div>
                    </div>
                    <button class="saved-item-expand" data-cat="${cat}" data-index="${i}" title="View recipe">▾</button>
                    <button class="saved-item-heart liked" data-cat="${cat}" data-index="${i}">♥</button>
                  </div>
                  <div class="saved-recipe-detail" id="saved-detail-${cat}-${i}" style="display:none">
                    ${m.description ? `<p class="saved-recipe-desc">${m.description}</p>` : ''}
                    ${m.ingredients ? `
                      <div class="saved-recipe-section">Ingredients</div>
                      <ul class="saved-recipe-list">
                        ${m.ingredients.map(ing => `<li>${ing.quantity} ${ing.name}</li>`).join('')}
                      </ul>` : ''}
                    ${m.instructions ? `
                      <div class="saved-recipe-section">Instructions</div>
                      <ol class="saved-recipe-list">
                        ${m.instructions.map(step => `<li>${step}</li>`).join('')}
                      </ol>` : ''}
                    ${!m.ingredients && !m.instructions ? `<p class="saved-recipe-desc" style="font-style:italic">No recipe details available.</p>` : ''}
                  </div>`).join('')}
          </div>`;
        }).join('')}
        ${Object.values(state.savedMeals).every(arr => arr.length === 0)
          ? `<div class="saved-empty-state"><div class="saved-empty-icon">🔖</div><p>No saved meals yet</p><span>Tap ♡ on any meal to save it here</span></div>`
          : ''}
      </div>
    </div>
  `;

  el.querySelector('#savedSearchInput').addEventListener('input', e => {
    state.savedSearch = e.target.value;
    renderSaved(el);
  });
  const clearBtn = el.querySelector('#savedSearchClear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    state.savedSearch = '';
    renderSaved(el);
  });
  el.querySelectorAll('.saved-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.savedFilter = btn.dataset.cat;
      renderSaved(el);
    });
  });
  el.querySelectorAll('.saved-item-expand').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = btn.dataset.cat;
      const idx = btn.dataset.index;
      const detail = el.querySelector(`#saved-detail-${cat}-${idx}`);
      if (!detail) return;
      const isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'block';
      btn.textContent = isOpen ? '▾' : '▴';
    });
  });
  el.querySelectorAll('.saved-item-heart').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const idx = parseInt(btn.dataset.index);
      state.savedMeals[cat].splice(idx, 1);
      renderSaved(el);
    });
  });
}

function showCategoryPicker(meal, onPick) {
  document.getElementById('catPickerModal')?.remove();
  const selected = new Set();

  const modal = document.createElement('div');
  modal.id = 'catPickerModal';
  modal.className = 'cat-modal-overlay';
  modal.innerHTML =
    '<div class="cat-modal">' +
      '<div class="cat-modal-title">Save to...</div>' +
      '<div class="cat-modal-meal">' + meal.name + '</div>' +
      '<p class="cat-modal-hint">Select one or more categories</p>' +
      '<div class="cat-modal-options">' +
        savedCategories.map(cat =>
          '<button class="cat-option-btn" data-cat="' + cat + '">' +
            '<span class="cat-option-icon">' + catIcon(cat) + '</span>' +
            '<span>' + cat + '</span>' +
            '<span class="cat-check-icon">✓</span>' +
          '</button>'
        ).join('') +
      '</div>' +
      '<button class="cat-modal-save" id="catModalSave" disabled>Save</button>' +
      '<button class="cat-modal-cancel">Cancel</button>' +
    '</div>';

  document.body.appendChild(modal);

  const saveBtn = modal.querySelector('#catModalSave');
  modal.querySelectorAll('.cat-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (selected.has(cat)) { selected.delete(cat); btn.classList.remove('selected'); }
      else { selected.add(cat); btn.classList.add('selected'); }
      saveBtn.disabled = selected.size === 0;
      saveBtn.textContent = selected.size > 0
        ? 'Save to ' + selected.size + ' categor' + (selected.size === 1 ? 'y' : 'ies')
        : 'Save';
    });
  });
  saveBtn.addEventListener('click', () => {
    if (selected.size > 0) { onPick([...selected]); modal.remove(); }
  });
  modal.querySelector('.cat-modal-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── PROFILE (their version) ──────────────────────────────
function renderProfile(el) {
  el.innerHTML = `
    <div class="profile-wrap">
      <div class="profile-avatar-row">
        <div class="avatar-wrap" id="avatarWrap">
          <div class="avatar" id="avatarCircle">
            ${state.profilePhoto ? `<img src="${state.profilePhoto}" class="avatar-img" />` : ''}
          </div>
          <div class="avatar-edit-btn" id="avatarEditBtn">✏️</div>
          <input type="file" id="avatarFileInput" accept="image/*" style="display:none" />
        </div>
        <div class="profile-name-wrap">
          <div class="profile-name" id="profileNameDisplay" ${state.profileEditing ? 'style="display:none"' : ''}>${state.profileName}</div>
          <input class="profile-name-input" id="profileNameInput" value="${state.profileName}" ${state.profileEditing ? '' : 'style="display:none"'} />
          <button class="name-edit-btn" id="nameEditBtn" ${state.profileEditing ? 'style="display:none"' : ''}>✏️</button>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-label">WEEKLY TARGETS</div>
        <div class="profile-box" style="flex-direction:column;gap:10px;">
          <div class="target-row">
            <span>Budget</span>
            <div class="target-input-wrap">
              <span class="target-prefix">$</span>
              <input class="target-input" id="budgetInput" type="number" min="0" value="${state.weeklyBudget}" />
              <span class="target-suffix">/week</span>
            </div>
          </div>
          <div class="target-row">
            <span>Calories</span>
            <div class="target-input-wrap">
              <input class="target-input" id="caloriesInput" type="number" min="0" value="${state.dailyCalories}" />
              <span class="target-suffix">/day</span>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-label">DIETARY RESTRICTIONS & HEALTH GOALS</div>
        <div class="profile-box" style="flex-direction:column; align-items:stretch; gap:10px;">
          <div>
            <div class="combo-sublabel">Dietary Restrictions</div>
            <div class="tag-row" id="dietTags">
              ${state.profileDietTags.map(t => `<span class="tag-pill">${t} <button class="tag-remove" data-section="diet" data-val="${t}">×</button></span>`).join('')}
            </div>
            <div class="autocomplete-wrap">
              <input class="combo-input" id="dietInput" placeholder="Type to add..." autocomplete="off" />
              <div class="suggestions-list" id="dietSuggestions"></div>
            </div>
          </div>
          <div style="border-top:1px solid #e8ede9; padding-top:10px;">
            <div class="combo-sublabel">Health Goals</div>
            <div class="tag-row" id="goalTags">
              ${state.profileGoalTags.map(t => `<span class="tag-pill">${t} <button class="tag-remove" data-section="goal" data-val="${t}">×</button></span>`).join('')}
            </div>
            <div class="autocomplete-wrap">
              <input class="combo-input" id="goalInput" placeholder="Type to add..." autocomplete="off" />
              <div class="suggestions-list" id="goalSuggestions"></div>
            </div>
          </div>
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

      <button class="signout-btn">Sign out</button>
    </div>
  `;

  el.querySelector('#budgetInput').addEventListener('change', e => {
    state.weeklyBudget = parseInt(e.target.value) || 0;
  });
  el.querySelector('#caloriesInput').addEventListener('change', e => {
    state.dailyCalories = parseInt(e.target.value) || 0;
  });
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

  const avatarEditBtn = el.querySelector('#avatarEditBtn');
  const avatarFileInput = el.querySelector('#avatarFileInput');
  const avatarCircle = el.querySelector('#avatarCircle');
  avatarEditBtn.addEventListener('click', () => avatarFileInput.click());
  avatarFileInput.addEventListener('change', () => {
    const file = avatarFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      state.profilePhoto = e.target.result;
      avatarCircle.innerHTML = `<img src="${state.profilePhoto}" class="avatar-img" />`;
    };
    reader.readAsDataURL(file);
  });

  const nameDisplay = el.querySelector('#profileNameDisplay');
  const nameInput = el.querySelector('#profileNameInput');
  const nameEditBtn = el.querySelector('#nameEditBtn');
  nameEditBtn.addEventListener('click', () => {
    nameDisplay.style.display = 'none';
    nameEditBtn.style.display = 'none';
    nameInput.style.display = 'block';
    nameInput.focus();
    nameInput.select();
    state.profileEditing = true;
  });
  nameInput.addEventListener('blur', () => {
    const newName = nameInput.value.trim() || state.profileName;
    state.profileName = newName;
    state.profileEditing = false;
    nameDisplay.textContent = newName;
    nameDisplay.style.display = 'block';
    nameEditBtn.style.display = 'inline-flex';
    nameInput.style.display = 'none';
  });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameInput.blur(); });

  const dietOptions = [
    'Vegetarian','Vegan','Gluten-free','Dairy-free','Lactose-free',
    'Nut-free','Egg-free','Halal','Kosher','Pescatarian',
    'Low carb','Keto','High protein','Low fat','Plant-based'
  ];
  const goalOptions = [
    'Weight loss','Weight gain','Muscle gain','Bulking','Cutting',
    'More energy','Gut health','Reduce bloating','Diabetes management'
  ];

  setupAutocomplete({
    input: el.querySelector('#dietInput'),
    suggestionsEl: el.querySelector('#dietSuggestions'),
    tagsEl: el.querySelector('#dietTags'),
    options: dietOptions,
    section: 'diet',
    el
  });
  setupAutocomplete({
    input: el.querySelector('#goalInput'),
    suggestionsEl: el.querySelector('#goalSuggestions'),
    tagsEl: el.querySelector('#goalTags'),
    options: goalOptions,
    section: 'goal',
    el
  });

  el.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      const val = btn.dataset.val;
      if (section === 'diet') {
        state.profileDietTags = state.profileDietTags.filter(t => t !== val);
      } else {
        state.profileGoalTags = state.profileGoalTags.filter(t => t !== val);
      }
      renderProfile(el);
    });
  });
}

function setupAutocomplete({ input, suggestionsEl, tagsEl, options, section, el }) {
  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    suggestionsEl.innerHTML = '';
    if (!val) { suggestionsEl.style.display = 'none'; return; }
    const matches = options.filter(o =>
      o.toLowerCase().startsWith(val) &&
      !(section === 'diet' ? state.profileDietTags : state.profileGoalTags)
        .map(t => t.toLowerCase()).includes(o.toLowerCase())
    );
    if (matches.length === 0) { suggestionsEl.style.display = 'none'; return; }
    suggestionsEl.style.display = 'block';
    matches.forEach(match => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = match;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        addTag(match, section, tagsEl, el);
        input.value = '';
        suggestionsEl.style.display = 'none';
      });
      suggestionsEl.appendChild(item);
    });
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { suggestionsEl.style.display = 'none'; }, 150);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (val) { addTag(val, section, tagsEl, el); input.value = ''; suggestionsEl.style.display = 'none'; }
    }
  });
}

function addTag(val, section, tagsEl, el) {
  const tags = section === 'diet' ? state.profileDietTags : state.profileGoalTags;
  if (tags.map(t => t.toLowerCase()).includes(val.toLowerCase())) return;
  tags.push(val);
  const span = document.createElement('span');
  span.className = 'tag-pill';
  span.innerHTML = `${val} <button class="tag-remove" data-section="${section}" data-val="${val}">×</button>`;
  span.querySelector('.tag-remove').addEventListener('click', () => {
    if (section === 'diet') {
      state.profileDietTags = state.profileDietTags.filter(t => t !== val);
    } else {
      state.profileGoalTags = state.profileGoalTags.filter(t => t !== val);
    }
    span.remove();
  });
  tagsEl.appendChild(span);
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
    chrome.storage.local.set({ onboarded: true });
    showStep('step-app');
    renderTab('chat');
  });

  chrome.storage.local.get(['onboarded'], result => {
    if (result.onboarded) {
      showStep('step-app');
      renderTab('chat');
    }
  });
});