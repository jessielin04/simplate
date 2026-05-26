// ── State ──────────────────────────────────────────────
const state = {
  diet: { lifestyle: [], allergies: [], other: '' },
  goals: [],
  householdSize: 1,
  weeklyBudget: 120,
  dailyCalories: 1800,
  profileDietTags: ['Gluten-free'],
  profileGoalTags: ['Gain muscle'],
  profileName: 'Mary Jane',
  profilePhoto: null,
  profileEditing: false,
  fulfillmentPreference: 'delivery', // 'delivery' | 'pickup'
  currentTab: 'chat',
  currentDay: new Date().getDay(),
  groceryItems: [],
  meals: {},
  savedMeals: { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] },
  savedSearch: '',
  savedFilter: 'All',
  chatMessages: [
    { role: 'bot', text: "Hi! I'm Simplate, your nutrition assistant. Ask me anything about your cart or meal plan." }
  ]
};

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      state.currentTab = btn.dataset.tab;
      syncActiveTab();
      renderTab(state.currentTab);
    });
  });
}

function syncActiveTab() {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === state.currentTab);
  });
}

function renderTab(tab) {
  state.currentTab = tab;
  syncActiveTab();
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
  const profileIncomplete = state.profileDietTags.length === 0 && state.profileGoalTags.length === 0;
  el.innerHTML = `
    <div class="chat-wrap">
      ${profileIncomplete ? `
        <div class="profile-nudge-banner" id="profileNudgeBtn">
          Complete your profile
          <span>Add dietary restrictions &amp; health goals for better suggestions →</span>
        </div>` : ''}
      <div class="chat-messages" id="chatMessages">${state.chatMessages.map((m, idx) => {
        if (m.role === 'recipe-actions') {
          return `<div class="recipe-action-bar" data-idx="${idx}">
            <button class="recipe-action-btn" data-action="add-to-list" data-idx="${idx}">🛒 Add ingredients to List</button>
            <button class="recipe-action-btn secondary" data-action="add-to-meals" data-idx="${idx}">📅 Save to Meals</button>
          </div>`;
        }
        return `<div class="chat-bubble ${m.role}">${m.text.replace(/\n/g, '<br>')}</div>`;
      }).join('')}</div>
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
        state.lastRecipe = data.recipe;
        state.chatMessages.push({ role: 'recipe-actions', recipe: data.recipe });
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

  el.querySelectorAll('.recipe-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const recipe = state.chatMessages[idx]?.recipe;
      if (!recipe) return;

      if (btn.dataset.action === 'add-to-list') {
        state.groceryItems = recipe.ingredients.map(ing => ({
          name: ing.name,
          sub: 'Click to pick a product',
          status: 'pending',
          itemId: null
        }));
        renderTab('list');
      } else if (btn.dataset.action === 'add-to-meals') {
        showMealSlotPicker(recipe);
      }
    });
  });

  const nudge = el.querySelector('#profileNudgeBtn');
  if (nudge) nudge.addEventListener('click', () => renderTab('profile'));
}

// ── WALMART SEARCH (via backend scraper) ─────────────────
async function searchWalmart(query, maxResults = 5) {
  const res = await fetch(`http://localhost:5000/search?ingredient=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.results || [];
}

// ── GROCERY (our backend version) ────────────────────────
function renderGrocery(el) {
  if (state.groceryItems.length === 0) {
    el.innerHTML = `
      <div class="grocery-wrap">
        <div class="tab-empty-state">
          <div class="tab-empty-icon">🛒</div>
          <p>Your list is empty</p>
          <span>Ask the assistant for a recipe to build your list.</span>
        </div>
      </div>
    `;
    return;
  }
  const pending = state.groceryItems.filter(i => i.status === 'pending').length;
  const unavailable = state.groceryItems.filter(i => i.status === 'unavailable').length;
  const retryable = state.groceryItems.filter(i => i.status === 'selected' && i.itemId);

  let bannerHtml;
  if (unavailable > 0) {
    bannerHtml = `<div class="alert-banner" style="background:#fff3e0;color:#b85c00;border-color:#f0c080;">
      ${unavailable} item${unavailable > 1 ? 's' : ''} unavailable
      <span style="color:#b85c00;">Pick a different product below to add it to cart.</span>
    </div>`;
  } else if (pending > 0) {
    bannerHtml = `<div class="alert-banner">
      ${pending} item${pending > 1 ? 's' : ''} need a product selected
      <span>Tap any item below to choose.</span>
    </div>`;
  } else {
    bannerHtml = `<div class="alert-banner" style="background:#d4edda;color:#1a5c2a;">
      All ${state.groceryItems.length} items have products selected
      <span style="color:#2a7a3e;">Ready to add directly to your Walmart cart.</span>
    </div>`;
  }

  el.innerHTML = `
    <div class="grocery-wrap">
      ${bannerHtml}
      <div class="grocery-list">
        ${state.groceryItems.map((item, i) => `
          <div class="grocery-item ${item.status === 'unavailable' ? 'unavailable-row' : ''}" data-index="${i}">
            <div class="item-dot ${item.status}"></div>
            <div class="item-info">
              <div class="item-name">${item.name}</div>
              <div class="item-sub">${item.sub}</div>
              ${item.status === 'unavailable' ? `<button class="try-different-btn" data-index="${i}">Try different product →</button>` : ''}
            </div>
            ${item.status === 'pending'
              ? `<div class="item-arrow">›</div>`
              : item.status === 'unavailable'
              ? `<div class="item-arrow" style="color:#e07040;">›</div>`
              : `<div class="item-check checked"></div>`}
          </div>
        `).join('')}
      </div>
      <div class="grocery-footer">
        <button class="btn-full" id="addCartBtn">
          ${unavailable > 0 && retryable.length > 0 ? `Add ${retryable.length} available item${retryable.length > 1 ? 's' : ''} to cart` :
            pending > 0 ? `Add to cart | ${pending} items pending` : 'Add all to cart'}
        </button>
      </div>
    </div>
  `;

  // "Try different product" buttons on unavailable items
  el.querySelectorAll('.try-different-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.index);
      const item = state.groceryItems[i];
      item.sub = 'Searching...';
      renderGrocery(el);
      try {
        const results = await searchWalmart(item.name);
        if (results.length > 0) {
          showProductPicker(item.name, results, i, el, /* onPick clears unavailable */ true);
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

  el.querySelectorAll('.grocery-item').forEach(row => {
    row.addEventListener('click', async () => {
      const i = parseInt(row.dataset.index);
      const item = state.groceryItems[i];
      // "Try different product" button handles unavailable rows — skip raw row click
      if (item.status === 'unavailable') return;
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
    // Only send items that are selected and not flagged unavailable
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

    const itemNames = selected.map(i => i.productName || i.name);

    chrome.runtime.sendMessage(
      { type: 'simplate_start_atc', urls, itemNames, fulfillment: state.fulfillmentPreference },
      (response) => {
        btn.disabled = false;
        const added = response?.added ?? 0;
        const failed = response?.failed ?? [];

        failed.forEach(({ name }) => {
          const item = state.groceryItems.find(i => i.name === name);
          if (item) { item.status = 'unavailable'; item.sub = 'Out of stock or unavailable'; item.needsRetry = true; }
        });
        if (added > 0) {
          btn.textContent = `✓ Added ${added} item${added > 1 ? 's' : ''} — cart opening…`;
          setTimeout(() => renderGrocery(el), 3000);
        } else {
          renderGrocery(el);
        }
      }
    );
  });
}


// ── PRODUCT PICKER MODAL ─────────────────────────────────
function showProductPicker(ingredientName, products, itemIndex, groceryEl, clearUnavailable = false) {
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
      // Fully reset the item — clears unavailable/needsRetry regardless of how we got here
      const gi = state.groceryItems[itemIndex];
      gi.status = 'selected';
      gi.productName = p.name;
      gi.sub = `${p.name}${p.price != null ? ' ' + p.price : ''}`;
      gi.itemId = p.id;
      gi.productUrl = p.url;
      gi.needsRetry = false;
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

// ── MEALS (their version with category picker) ───────────
function renderMeals(el) {
  const today = state.currentDay;
  const hasMeals = Object.values(state.meals).some(arr => arr && arr.length > 0);

  if (!hasMeals) {
    el.innerHTML = `
      <div class="meals-wrap">
        <div class="tab-empty-state">
          <div class="tab-empty-icon">📅</div>
          <p>No meals planned yet</p>
          <span>Save a meal from chat to see it here.</span>
        </div>
      </div>
    `;
    return;
  }

  const meals = state.meals[today] || [];

  el.innerHTML = `
    <div class="meals-wrap">
      <div class="day-tabs">
        ${(() => {
          const now = new Date();
          const todayIdx = now.getDay();
          const sunday = new Date(now);
          sunday.setDate(now.getDate() - todayIdx);
          return days.map((d, i) => {
            const date = new Date(sunday);
            date.setDate(sunday.getDate() + i);
            return `<button class="day-tab ${i === today ? 'active' : ''}" data-day="${i}">
            <span>${d}</span>
            <span class="day-num">${date.getDate()}</span>
          </button>`;
          }).join('');
        })()}
      </div>
      <div class="meal-cards">
        ${meals.length === 0
          ? `<p class="day-empty-msg">No meals saved for this day. Ask the assistant for a recipe!</p>`
          : meals.map((m, mi) => `
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
      ${meals.length > 0 ? `
      <div class="regen-bar">
        <button class="btn-full" id="regenBtn">Regenerate with AI ✦</button>
      </div>` : ''}
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
      const dayMeals = state.meals[d] || [];
      const meal = dayMeals[mi];

      if (!meal.liked) {
        showCategoryPicker(meal, (cats) => {
          meal.liked = true;
          meal.savedCategories = cats;
          cats.forEach(cat => {
            if (!state.savedMeals[cat]) state.savedMeals[cat] = [];
            if (!state.savedMeals[cat].find(m => m.name === meal.name)) {
              state.savedMeals[cat].push({
                name: meal.name,
                meta: meal.meta,
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
          if (state.savedMeals[cat]) {
            state.savedMeals[cat] = state.savedMeals[cat].filter(m => m.name !== meal.name);
          }
        });
        meal.savedCategories = [];
        renderMeals(el);
      }
    });
  });

  const regenBtn = el.querySelector('#regenBtn');
  if (regenBtn) {
    regenBtn.addEventListener('click', async () => {
      const today = state.currentDay;
      regenBtn.disabled = true;
      regenBtn.textContent = 'Generating…';
      try {
        const res = await fetch('http://localhost:5000/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `Suggest a new meal plan for ${days[today]}. Give me one recipe.` }],
            dietary_restrictions: state.profileDietTags,
            health_goals: state.profileGoalTags
          })
        });
        const data = await res.json();
        if (data.recipe && data.recipe.ingredients) {
          showMealSlotPicker(data.recipe);
        } else {
          regenBtn.textContent = 'Regenerate with AI ✦';
          regenBtn.disabled = false;
        }
      } catch (e) {
        regenBtn.textContent = 'Error — try again';
        regenBtn.disabled = false;
      }
    });
  }
}

// ── SAVED (their version) ────────────────────────────────
const savedCategories = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

function catIcon(cat) {
  return { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙', Snacks: '🍎' }[cat] || '🍽️';
}

function renderSaved(el) {
  const query = state.savedSearch.toLowerCase();
  const activeFilter = state.savedFilter;

  el.innerHTML = `
    <div class="saved-wrap">
      <div class="saved-search-row">
        <div class="saved-search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="saved-search-input" id="savedSearchInput" placeholder="Search saved meals..." value="${state.savedSearch}" />
          ${state.savedSearch ? `<button class="saved-search-clear" id="savedSearchClear">×</button>` : ''}
        </div>
      </div>
      <div class="saved-filter-row">
        ${['All', ...savedCategories].map(cat => `
          <button class="saved-filter-btn ${activeFilter === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
        `).join('')}
      </div>
      <div class="saved-list">
        ${savedCategories
          .filter(cat => activeFilter === 'All' || activeFilter === cat)
          .map(cat => {
            const items = (state.savedMeals[cat] || []).filter(m =>
              !query || m.name.toLowerCase().includes(query)
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

function showMealSlotPicker(recipe) {
  document.getElementById('mealSlotModal')?.remove();
  const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER'];
  let selectedDay = state.currentDay;
  let selectedType = null;

  const now = new Date();
  const todayIdx = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - todayIdx);

  const modal = document.createElement('div');
  modal.id = 'mealSlotModal';
  modal.className = 'cat-modal-overlay';
  modal.innerHTML = `
    <div class="cat-modal">
      <div class="cat-modal-title">Add to Meals</div>
      <div class="cat-modal-meal">${recipe.recipe_name}</div>
      <p class="cat-modal-hint">Pick a day</p>
      <div class="slot-day-row">
        ${days.map((d, i) => {
          const date = new Date(sunday);
          date.setDate(sunday.getDate() + i);
          return `<button class="slot-day-btn ${i === selectedDay ? 'selected' : ''}" data-day="${i}">
            <span>${d}</span><span class="slot-day-num">${date.getDate()}</span>
          </button>`;
        }).join('')}
      </div>
      <p class="cat-modal-hint" style="margin-top:12px">Pick a meal slot</p>
      <div class="cat-modal-options">
        ${mealTypes.map(t => `
          <button class="cat-option-btn slot-type-btn" data-type="${t}">
            <span class="cat-option-icon">${{BREAKFAST:'🌅',LUNCH:'☀️',DINNER:'🌙'}[t]}</span>
            <span>${t.charAt(0) + t.slice(1).toLowerCase()}</span>
            <span class="cat-check-icon">✓</span>
          </button>`).join('')}
      </div>
      <button class="cat-modal-save" id="mealSlotSave" disabled>Save</button>
      <button class="cat-modal-cancel" id="mealSlotCancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll('.slot-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDay = parseInt(btn.dataset.day);
      modal.querySelectorAll('.slot-day-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  const saveBtn = modal.querySelector('#mealSlotSave');
  modal.querySelectorAll('.slot-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.type;
      modal.querySelectorAll('.slot-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save meal';
    });
  });

  saveBtn.addEventListener('click', () => {
    if (!selectedType) return;
    if (!state.meals[selectedDay]) state.meals[selectedDay] = [];
    // Remove existing slot of same type if present
    state.meals[selectedDay] = state.meals[selectedDay].filter(m => m.type !== selectedType);
    state.meals[selectedDay].push({
      type: selectedType,
      name: recipe.recipe_name,
      meta: `${recipe.servings} servings`,
      liked: false,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      description: recipe.description
    });
    modal.remove();
    renderTab('meals');
  });

  modal.querySelector('#mealSlotCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
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
            <span class="target-label">Budget</span>
            <div class="target-input-wrap">
              <span class="target-prefix">$</span>
              <input class="target-input" id="budgetInput" type="number" min="0" value="${state.weeklyBudget}" />
              <span class="target-suffix">/week</span>
            </div>
          </div>
          <div class="target-row">
            <span class="target-label">Calories</span>
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
        <div class="profile-section-label">FULFILLMENT PREFERENCE</div>
        <div class="profile-box" style="flex-direction:column; align-items:stretch; gap:6px;">
          <div class="combo-sublabel" style="margin-bottom:2px;">How should items be added to your cart?</div>
          <p style="margin:0 0 4px;font-size:11px;color:#9aada0;">If your preferred option isn't available, the other will be chosen.</p>
          <div class="tag-row">
            <button class="fulfill-pill ${state.fulfillmentPreference === 'delivery' ? 'active' : ''}" data-val="delivery">Delivery</button>
            <button class="fulfill-pill ${state.fulfillmentPreference === 'pickup' ? 'active' : ''}" data-val="pickup">Pickup</button>
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

      <button class="signout-btn" id="signOutBtn">Sign out</button>
    </div>
  `;

  el.querySelectorAll('.fulfill-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.fulfillmentPreference = btn.dataset.val;
      chrome.storage.local.set({ fulfillmentPreference: state.fulfillmentPreference });
      el.querySelectorAll('.fulfill-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

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

  el.querySelector('#signOutBtn').addEventListener('click', () => {
    chrome.storage.local.remove(['onboarded', 'fulfillmentPreference'], () => {
      Object.assign(state, {
        diet: { lifestyle: [], allergies: [], other: '' },
        goals: [],
        householdSize: 1,
        weeklyBudget: 120,
        dailyCalories: 1800,
        profileDietTags: [],
        profileGoalTags: [],
        fulfillmentPreference: 'delivery',
        chatMessages: [{ role: 'bot', text: "Hi! I'm Simplate, your nutrition assistant. Ask me anything about your cart or meal plan." }],
        savedMeals: { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] },
        groceryItems: [],
        currentTab: 'chat',
      });
      showStep('step-welcome');
    });
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
    const dietTags = [];
    document.querySelectorAll('#step-diet .pill.selected').forEach(p => dietTags.push(p.textContent.trim()));
    const dietOther = document.getElementById('dietOther')?.value.trim();
    if (dietOther) dietTags.push(dietOther);
    state.profileDietTags = dietTags;
    state.diet.lifestyle = dietTags;

    const goalTags = [];
    document.querySelectorAll('#step-goals .pill.selected').forEach(p => goalTags.push(p.textContent.trim()));
    state.profileGoalTags = goalTags;
    state.goals = goalTags;

    state.householdSize = parseInt(document.getElementById('hhCount')?.textContent) || 1;

    chrome.storage.local.set({ onboarded: true });
    showStep('step-app');
    renderTab('chat');
  });

  chrome.storage.local.get(['onboarded', 'fulfillmentPreference'], result => {
    if (result.fulfillmentPreference) state.fulfillmentPreference = result.fulfillmentPreference;
    if (result.onboarded) {
      showStep('step-app');
      renderTab('chat');
    }
  });
});