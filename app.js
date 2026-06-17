// Nutri Nexus Core Application Logic
// References: FOOD_DATA (foodData.js), RDA_DATA (rdaData.js)

// Application State
let appState = {
    profile: {
        age: 25,
        gender: "male",
        weight: "",
        height: "",
        activity: "sedentary",
        status: "none"
    },
    loggedFoods: [],
    selectedFood: null
};

// Initialize App
function init() {
    loadSavedState();
    setupProfileForm();
    setupFoodSearch();
    setupTheme();
    
    // Bind print report button
    document.getElementById("btn-download-pdf").addEventListener("click", downloadPDF);
    
    // Bind refresh button
    document.getElementById("btn-refresh-ledger").addEventListener("click", refreshCalculations);
    
    // Initial calculation and UI updates
    updateRDAAndDashboard();
    renderLedger();
}

// Refresh calculations and UI with spinning visual feedback
function refreshCalculations() {
    const icon = document.getElementById("svg-refresh-icon");
    if (icon) {
        icon.classList.remove("spinning");
        // Force reflow to allow restarting the animation
        void icon.offsetWidth;
        icon.classList.add("spinning");
    }
    updateRDAAndDashboard();
    renderLedger();
}

// Load settings and log data from localStorage
function loadSavedState() {
    // Load profile
    const savedProfile = localStorage.getItem("nutrinexus_profile");
    if (savedProfile) {
        try {
            appState.profile = JSON.parse(savedProfile);
            restoreProfileFormValues();
        } catch (e) {
            console.error("Failed to restore profile state", e);
        }
    }

    // Load logged food
    const savedLog = localStorage.getItem("nutrinexus_log");
    if (savedLog) {
        try {
            appState.loggedFoods = JSON.parse(savedLog);
        } catch (e) {
            console.error("Failed to restore food ledger state", e);
        }
    }
}

// Restore form fields from state
function restoreProfileFormValues() {
    document.getElementById("profile-age").value = appState.profile.age;
    document.getElementById("profile-gender").value = appState.profile.gender;
    document.getElementById("profile-weight").value = appState.profile.weight || "";
    document.getElementById("profile-height").value = appState.profile.height || "";
    document.getElementById("profile-activity").value = appState.profile.activity;
    
    // Toggle gender-based pregnancy option
    toggleStatusGroup(appState.profile.gender);
    if (appState.profile.gender === "female") {
        document.getElementById("profile-status").value = appState.profile.status;
    }
}

// Manage user profile configurations
function setupProfileForm() {
    const form = document.getElementById("profile-form");
    const genderSelect = document.getElementById("profile-gender");
    
    // Listen for inputs
    const inputs = form.querySelectorAll("input, select");
    inputs.forEach(input => {
        input.addEventListener("change", () => {
            updateProfileState();
        });
        input.addEventListener("input", () => {
            // Instant calculate on typing numbers
            if (input.type === "number") {
                updateProfileState();
            }
        });
    });

    genderSelect.addEventListener("change", (e) => {
        toggleStatusGroup(e.target.value);
    });
}

function toggleStatusGroup(gender) {
    const statusGroup = document.getElementById("status-group");
    if (gender === "female") {
        statusGroup.style.display = "flex";
    } else {
        statusGroup.style.display = "none";
        document.getElementById("profile-status").value = "none";
        appState.profile.status = "none";
    }
}

function updateProfileState() {
    appState.profile.age = parseInt(document.getElementById("profile-age").value) || 25;
    appState.profile.gender = document.getElementById("profile-gender").value;
    appState.profile.weight = document.getElementById("profile-weight").value ? parseFloat(document.getElementById("profile-weight").value) : "";
    appState.profile.height = document.getElementById("profile-height").value ? parseFloat(document.getElementById("profile-height").value) : "";
    appState.profile.activity = document.getElementById("profile-activity").value;
    appState.profile.status = document.getElementById("profile-status").value;

    localStorage.setItem("nutrinexus_profile", JSON.stringify(appState.profile));
    updateRDAAndDashboard();
}

// Manage Food Autocomplete search
function setupFoodSearch() {
    const searchInput = document.getElementById("food-search");
    const dropdown = document.getElementById("autocomplete-list");
    const clearBtn = document.getElementById("btn-clear-search");
    const qtyInput = document.getElementById("food-quantity");
    const addBtn = document.getElementById("btn-add-food");

    searchInput.addEventListener("input", (e) => {
        const value = e.target.value.trim().toLowerCase();
        
        if (!value) {
            hideDropdown();
            clearBtn.style.display = "none";
            return;
        }

        clearBtn.style.display = "block";
        
        // Tokenize search input for multi-word query support
        const queryTokens = value.split(/\s+/).filter(Boolean);
        
        // Helper to check if a token is in the food item
        const matchesToken = (food, token) => {
            if (food.name.toLowerCase().includes(token)) return true;
            if (food.aliases && food.aliases.some(alias => alias.toLowerCase().includes(token))) return true;
            return false;
        };

        // 1. Starts with exact query
        const startsWithMatches = FOOD_DATA.filter(f => f.name.toLowerCase().startsWith(value));
        
        // 2. Contains exact query (but doesn't start with it)
        const containsMatches = FOOD_DATA.filter(f => !f.name.toLowerCase().startsWith(value) && f.name.toLowerCase().includes(value));
        
        // 3. Aliases contain exact query
        const aliasMatches = FOOD_DATA.filter(f => 
            !f.name.toLowerCase().includes(value) && 
            f.aliases && 
            f.aliases.some(alias => alias.toLowerCase().includes(value))
        );

        // Pre-combine exact matches to easily avoid duplicates
        const exactMatches = [...startsWithMatches, ...containsMatches, ...aliasMatches];
        const exactSet = new Set(exactMatches);

        // 4. Multi-token AND matches: every query token matches the food
        const andMatches = FOOD_DATA.filter(f => {
            if (exactSet.has(f)) return false;
            return queryTokens.every(token => matchesToken(f, token));
        });

        // 5. Multi-token OR matches (fallback sorted by score)
        let orMatches = [];
        if (exactMatches.length + andMatches.length < 8) {
            const combinedSet = new Set([...exactMatches, ...andMatches]);
            orMatches = FOOD_DATA.map(f => {
                if (combinedSet.has(f)) return null;
                const score = queryTokens.filter(token => matchesToken(f, token)).length;
                return score > 0 ? { food: f, score } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score)
            .map(item => item.food);
        }

        const filtered = [...exactMatches, ...andMatches, ...orMatches].slice(0, 8);

        if (filtered.length === 0) {
            dropdown.innerHTML = `<div class="autocomplete-item text-muted">No matching Indian food items found</div>`;
            dropdown.style.display = "block";
            return;
        }

        dropdown.innerHTML = filtered.map(food => `
            <div class="autocomplete-item" data-name="${escapeHtml(food.name)}">
                <strong>${escapeHtml(food.name)}</strong> 
                <span style="font-size:11px; color:var(--text-muted);">(${escapeHtml(food.category)})</span>
            </div>
        `).join('');

        dropdown.style.display = "block";

        // Click suggestions
        dropdown.querySelectorAll(".autocomplete-item").forEach(el => {
            el.addEventListener("click", () => {
                const name = el.getAttribute("data-name");
                selectFoodItem(name);
            });
        });
    });

    // Keyboard navigation in search
    searchInput.addEventListener("keydown", (e) => {
        const items = dropdown.querySelectorAll(".autocomplete-item");
        if (items.length === 0 || dropdown.style.display === "none") return;

        let activeIdx = Array.from(items).findIndex(item => item.classList.contains("active"));

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (activeIdx < items.length - 1) {
                if (activeIdx >= 0) items[activeIdx].classList.remove("active");
                items[activeIdx + 1].classList.add("active");
                items[activeIdx + 1].scrollIntoView({ block: 'nearest' });
            } else if (activeIdx === -1) {
                items[0].classList.add("active");
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (activeIdx > 0) {
                items[activeIdx].classList.remove("active");
                items[activeIdx - 1].classList.add("active");
                items[activeIdx - 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIdx >= 0) {
                const name = items[activeIdx].getAttribute("data-name");
                selectFoodItem(name);
            }
        }
    });

    // Clear search button
    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        hideDropdown();
        clearBtn.style.display = "none";
        appState.selectedFood = null;
        document.getElementById("selected-food-details").style.display = "none";
        addBtn.disabled = true;
    });

    // Hide dropdown on blur / document clicks
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-container")) {
            hideDropdown();
        }
    });

    function hideDropdown() {
        dropdown.style.display = "none";
    }

    // Update preview when quantity or unit changes
    qtyInput.addEventListener("input", updatePreview);
    document.getElementById("food-unit-select").addEventListener("change", updatePreview);

    // Add Log button handler
    addBtn.addEventListener("click", () => {
        if (!appState.selectedFood) return;
        
        const qtyVal = parseFloat(qtyInput.value) || 0;
        const unitVal = document.getElementById("food-unit-select").value;
        const food = appState.selectedFood;
        
        let weight = 0;
        let displayQty = "";
        
        if (unitVal === "serving" && food.servingSize !== undefined) {
            weight = qtyVal * food.servingSize;
            displayQty = `${qtyVal} ${food.servingUnit}`;
        } else {
            weight = qtyVal;
            displayQty = `${qtyVal} g`;
        }
        
        if (weight <= 0) return;
        
        addFoodToLedger(food, weight, displayQty);

        // Reset search states
        searchInput.value = "";
        clearBtn.style.display = "none";
        qtyInput.value = 1;
        appState.selectedFood = null;
        document.getElementById("selected-food-details").style.display = "none";
        addBtn.disabled = true;
    });
}

function selectFoodItem(name) {
    const food = FOOD_DATA.find(f => f.name === name);
    if (!food) return;

    appState.selectedFood = food;
    document.getElementById("food-search").value = food.name;
    document.getElementById("autocomplete-list").style.display = "none";
    
    const qtyInput = document.getElementById("food-quantity");
    const unitSelect = document.getElementById("food-unit-select");
    
    // Clear and populate unit options
    unitSelect.innerHTML = "";
    if (food.servingSize !== undefined && food.servingUnit !== undefined && food.servingUnit !== "g") {
        const optionServing = document.createElement("option");
        optionServing.value = "serving";
        // Capitalize unit
        const formattedUnit = food.servingUnit.charAt(0).toUpperCase() + food.servingUnit.slice(1);
        optionServing.textContent = `${formattedUnit} (${food.servingSize}g)`;
        unitSelect.appendChild(optionServing);
        
        const optionG = document.createElement("option");
        optionG.value = "g";
        optionG.textContent = "g (grams)";
        unitSelect.appendChild(optionG);
        
        qtyInput.value = 1;
    } else {
        const optionG = document.createElement("option");
        optionG.value = "g";
        optionG.textContent = "g (grams)";
        unitSelect.appendChild(optionG);
        
        qtyInput.value = 100;
    }
    
    updatePreview();
    
    document.getElementById("selected-food-details").style.display = "block";
    document.getElementById("btn-add-food").disabled = false;
}

// Update the preview box metrics dynamically
function updatePreview() {
    const food = appState.selectedFood;
    if (!food) return;
    
    const qtyInput = document.getElementById("food-quantity");
    const unitSelect = document.getElementById("food-unit-select");
    
    const qtyVal = parseFloat(qtyInput.value) || 0;
    const unitVal = unitSelect.value;
    
    let weight = 0;
    if (unitVal === "serving" && food.servingSize !== undefined) {
        weight = qtyVal * food.servingSize;
    } else {
        weight = qtyVal;
    }
    
    const scale = weight / 100;
    
    document.getElementById("det-food-name").textContent = `${food.name} (${Math.round(weight)}g)`;
    document.getElementById("det-energy").textContent = Math.round(food.energy * scale);
    document.getElementById("det-protein").textContent = (food.protein * scale).toFixed(1);
    document.getElementById("det-carbs").textContent = (food.carb * scale).toFixed(1);
    document.getElementById("det-fat").textContent = (food.fat * scale).toFixed(1);
}

// Add Item to Log State
function addFoodToLedger(food, weight, displayQty) {
    const logItem = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        name: food.name,
        qty: weight,
        displayQty: displayQty || `${weight} g`,
        energy: (weight / 100) * food.energy,
        protein: (weight / 100) * food.protein,
        carb: (weight / 100) * food.carb,
        fat: (weight / 100) * food.fat,
        fiber: (weight / 100) * food.fiber,
        calcium: (weight / 100) * food.calcium,
        iron: (weight / 100) * food.iron,
        vitc: (weight / 100) * food.vitc
    };

    appState.loggedFoods.push(logItem);
    localStorage.setItem("nutrinexus_log", JSON.stringify(appState.loggedFoods));
    
    updateRDAAndDashboard();
    renderLedger();
}

// Delete Item from Log State
function deleteLedgerItem(id) {
    appState.loggedFoods = appState.loggedFoods.filter(item => item.id !== id);
    localStorage.setItem("nutrinexus_log", JSON.stringify(appState.loggedFoods));
    
    updateRDAAndDashboard();
    renderLedger();
}

// Render ledger log data list
function renderLedger() {
    const tbody = document.getElementById("ledger-body");
    const clearLogBtn = document.getElementById("btn-clear-log");
    const downloadPdfBtn = document.getElementById("btn-download-pdf");
    
    if (appState.loggedFoods.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">No food items logged for today.</td>
            </tr>
        `;
        clearLogBtn.disabled = true;
        downloadPdfBtn.disabled = true;
        return;
    }

    clearLogBtn.disabled = false;
    downloadPdfBtn.disabled = false;
    tbody.innerHTML = appState.loggedFoods.map(item => `
        <tr>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td class="text-right">${escapeHtml(item.displayQty || (item.qty + " g"))}</td>
            <td class="text-right">${Math.round(item.energy)} kcal</td>
            <td class="text-right">${item.protein.toFixed(1)}g</td>
            <td class="text-right hide-mobile">${item.carb.toFixed(1)}g</td>
            <td class="text-right hide-mobile">${item.fat.toFixed(1)}g</td>
            <td class="text-right hide-mobile">${item.fiber.toFixed(1)}g</td>
            <td class="text-center">
                <button class="btn-delete-row" data-id="${item.id}" title="Remove Entry">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Bind delete click actions
    tbody.querySelectorAll(".btn-delete-row").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            deleteLedgerItem(id);
        });
    });
}

// Aggregate food entries and update target limits
function updateRDAAndDashboard() {
    const rda = RDA_DATA.calculateRDA(appState.profile);

    // Initial sum values
    let totals = {
        energy: 0, protein: 0, fat: 0, fiber: 0, calcium: 0, iron: 0, vitc: 0
    };

    // Calculate sum inputs
    appState.loggedFoods.forEach(food => {
        totals.energy += food.energy;
        totals.protein += food.protein;
        totals.fat += food.fat;
        totals.fiber += food.fiber;
        totals.calcium += food.calcium;
        totals.iron += food.iron;
        totals.vitc += food.vitc;
    });

    // Update progress dashboards
    updateProgressCard("energy", totals.energy, rda.energy, "kcal");
    updateProgressCard("protein", totals.protein, rda.protein, "g");
    updateProgressCard("fat", totals.fat, rda.fat, "g");
    updateProgressCard("fiber", totals.fiber, rda.fiber, "g");

    // Update micros gauges
    updateMicroGauge("calcium", totals.calcium, rda.calcium, "mg");
    updateMicroGauge("iron", totals.iron, rda.iron, "mg");
    updateMicroGauge("vitc", totals.vitc, rda.vitc, "mg");

    // Update Notes / Warnings block
    renderTelemetryAlerts(totals, rda);
}

function updateProgressCard(id, current, target, unit) {
    const numEl = document.getElementById(`num-${id}`);
    const fillEl = document.getElementById(`fill-${id}`);
    const pctEl = document.getElementById(`pct-${id}`);
    const statEl = document.getElementById(`stat-${id}`);

    const percent = target > 0 ? Math.round((current / target) * 100) : 0;
    numEl.textContent = `${Math.round(current)} / ${target} ${unit}`;
    pctEl.textContent = `${percent}%`;

    // Cap width at 100% in progress track visual
    fillEl.style.width = `${Math.min(percent, 100)}%`;

    // Clear classes
    fillEl.className = "p-fill";
    statEl.className = "p-status";

    if (percent === 0) {
        statEl.textContent = "Unstarted";
        statEl.classList.add("under");
    } else if (percent < 80) {
        statEl.textContent = "Under Target";
        statEl.classList.add("under");
    } else if (percent >= 80 && percent <= 110) {
        statEl.textContent = "Optimal Range";
        statEl.classList.add("ideal");
        fillEl.classList.add("ideal");
    } else if (percent > 110 && percent <= 130) {
        statEl.textContent = "Slight Excess";
        statEl.classList.add("over");
        fillEl.classList.add("over");
    } else {
        statEl.textContent = "Excess Limit";
        statEl.classList.add("danger");
        fillEl.classList.add("danger");
    }
}

function updateMicroGauge(id, current, target, unit) {
    const numEl = document.getElementById(`num-${id}`);
    const fillEl = document.getElementById(`fill-${id}`);
    
    numEl.textContent = `${current.toFixed(1)} / ${target} ${unit}`;
    const percent = target > 0 ? Math.round((current / target) * 100) : 0;
    fillEl.style.width = `${Math.min(percent, 100)}%`;
}

function renderTelemetryAlerts(totals, rda) {
    const container = document.getElementById("alerts-container");
    const notesEl = document.getElementById("rda-notes");

    let alerts = [];

    // Calculate BMI and Indian consensus parameters
    const height = parseFloat(appState.profile.height);
    const weight = parseFloat(appState.profile.weight) || RDA_DATA.getDefaultWeight(appState.profile.age, appState.profile.gender);
    
    if (height > 0) {
        const heightM = height / 100;
        const bmi = weight / (heightM * heightM);
        let classification = "";
        let bmiColor = "var(--color-success)";
        let noteText = "";
        
        if (bmi < 18.5) {
            classification = "Underweight";
            bmiColor = "var(--color-warning)";
            noteText = "Increase calorie intake (+300 kcal/day) with nutrient-dense foods for weight gain.";
        } else if (bmi >= 18.5 && bmi < 23.0) {
            classification = "Normal";
            bmiColor = "var(--color-success)";
            noteText = "Healthy range. Maintain baseline RDA requirements.";
        } else if (bmi >= 23.0 && bmi < 25.0) {
            classification = "Overweight (Asian Indian standards)";
            bmiColor = "var(--color-warning)";
            noteText = "Consider moderate calorie deficit (-300 kcal/day) and physical activity.";
        } else {
            classification = "Obese (Asian Indian standards)";
            bmiColor = "var(--color-danger)";
            noteText = "Target calorie deficit (-500 kcal/day) and consult with a medical professional.";
        }
        
        const idealWeight = (21 * heightM * heightM).toFixed(1);
        alerts.push(`<strong>Anthropometrics:</strong> BMI: <span style="color:${bmiColor}; font-weight:700;">${bmi.toFixed(1)}</span> (${classification}). Ideal Body Weight (Target BMI 21): <strong>${idealWeight} kg</strong>. <em>Guideline: ${noteText}</em>`);
    }

    // Demographic baseline warnings
    if (rda.notes && rda.notes.length > 0) {
        alerts.push(...rda.notes);
    }

    // Nutrient alerts
    if (totals.energy > rda.energy * 1.15) {
        alerts.push(`<strong style="color:var(--color-danger)">Caloric Surplus:</strong> You have exceeded your daily energy requirement by over 15%. Consider reducing portion sizes.`);
    }
    if (totals.fat > rda.fat * 1.15) {
        alerts.push(`<strong style="color:var(--color-danger)">High Fat Intake:</strong> Daily fat exceeds recommended limits. Visible fat (cooking oil/ghee) limit is ${rda.visibleFatLimit}g/day.`);
    }
    if (appState.loggedFoods.length > 0) {
        if (totals.protein < rda.protein * 0.75) {
            alerts.push(`<strong style="color:var(--color-warning)">Protein Deficit:</strong> Current intake is low. Focus on protein sources like Dals, Legumes, Milk/Curd, Paneer, or Eggs.`);
        }
        if (totals.fiber < rda.fiber * 0.75) {
            alerts.push(`<strong style="color:var(--color-warning)">Low Fiber Intake:</strong> Add whole grains (Whole wheat roti/brown rice), green leafy vegetables, or fresh fruits to increase fiber.`);
        }
        if (totals.iron < rda.iron * 0.75) {
            alerts.push(`<strong style="color:var(--color-warning)">Iron Deficiency Risk:</strong> Especially vital for women. Incorporate spinach, amaranth, raisins, or dates.`);
        }
    }

    if (alerts.length === 0) {
        notesEl.innerHTML = "Log items above to evaluate your food profile. All targets reflect NIN 2024 revisions.";
        container.style.borderLeftColor = "var(--border-color)";
        return;
    }

    container.style.borderLeftColor = alerts.some(a => a.includes("Surplus") || a.includes("High Fat") || a.includes("Obese")) ? "var(--color-danger)" : "var(--color-warning)";
    notesEl.innerHTML = `<ul style="list-style:none; display:flex; flex-direction:column; gap:6px;">
        ${alerts.map(a => `<li><span style="color: var(--color-primary); margin-right: 6px; font-weight: bold;">▸</span>${a}</li>`).join('')}
    </ul>`;
}

// Reset ledger log handler
document.getElementById("btn-clear-log").addEventListener("click", () => {
    if (confirm("Are you sure you want to clear your daily food intake ledger?")) {
        appState.loggedFoods = [];
        localStorage.removeItem("nutrinexus_log");
        updateRDAAndDashboard();
        renderLedger();
    }
});

// App Theme Controller (Light / Dark)
function setupTheme() {
    const toggle = document.getElementById("theme-toggle");
    
    const sunSVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></svg>`;
    const moonSVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    // Check saved settings
    const savedTheme = localStorage.getItem("nutrinexus_theme");
    if (savedTheme === "dark") {
        document.body.className = "dark-theme";
        toggle.innerHTML = sunSVG;
    } else {
        document.body.className = "light-theme";
        toggle.innerHTML = moonSVG;
    }

    toggle.addEventListener("click", () => {
        if (document.body.classList.contains("light-theme")) {
            document.body.className = "dark-theme";
            toggle.innerHTML = sunSVG;
            localStorage.setItem("nutrinexus_theme", "dark");
        } else {
            document.body.className = "light-theme";
            toggle.innerHTML = moonSVG;
            localStorage.setItem("nutrinexus_theme", "light");
        }
    });
}

// PDF Export Report Logic
function downloadPDF() {
    if (appState.loggedFoods.length === 0) return;

    const rda = RDA_DATA.calculateRDA(appState.profile);

    // Sum totals
    let totals = {
        energy: 0, protein: 0, fat: 0, fiber: 0, calcium: 0, iron: 0, vitc: 0
    };
    appState.loggedFoods.forEach(f => {
        totals.energy += f.energy;
        totals.protein += f.protein;
        totals.fat += f.fat;
        totals.fiber += f.fiber;
        totals.calcium += f.calcium;
        totals.iron += f.iron;
        totals.vitc += f.vitc;
    });

    const dateStr = new Date().toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const height = parseFloat(appState.profile.height);
    let bmiDisplay = "N/A";
    let heightDisplay = "Not entered";
    
    if (height > 0) {
        heightDisplay = `${height} cm`;
        const weight = parseFloat(appState.profile.weight) || RDA_DATA.getDefaultWeight(appState.profile.age, appState.profile.gender);
        const bmi = weight / ((height / 100) * (height / 100));
        let classification = "Normal";
        if (bmi < 18.5) classification = "Underweight";
        else if (bmi >= 18.5 && bmi < 23.0) classification = "Normal";
        else if (bmi >= 23.0 && bmi < 25.0) classification = "Overweight";
        else if (bmi >= 25.0) classification = "Obese";
        bmiDisplay = `${bmi.toFixed(1)} (${classification})`;
    }

    const weightDisplay = appState.profile.weight ? `${appState.profile.weight} kg` : `Reference default (${RDA_DATA.getDefaultWeight(appState.profile.age, appState.profile.gender)} kg)`;

    // Construct print template HTML
    const reportHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Nutri Nexus Telemetry Report - biolabs Os Healix</title>
        <style>
            body { font-family: 'Inter', sans-serif; color: #0f172a; padding: 40px; line-height: 1.5; font-size: 13px; background-color: #ffffff; }
            .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 24px; border-collapse: collapse; }
            .brand-name { font-size: 26px; font-weight: bold; color: #0284c7; margin: 0; line-height: 1.1; }
            .powered-by { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; }
            .doc-title { text-align: right; font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: 0.5px; }
            .report-date { text-align: right; font-size: 11px; color: #64748b; margin-top: 4px; }
            
            .section-title { font-size: 12px; text-transform: uppercase; color: #0f172a; font-weight: 800; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 12px; margin-top: 24px; letter-spacing: 0.5px; }
            
            .meta-grid { display: table; width: 100%; table-layout: fixed; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; border-collapse: collapse; }
            .meta-item { display: table-cell; padding: 12px; border-right: 1px solid #e2e8f0; }
            .meta-item:last-child { border-right: none; }
            .meta-label { font-size: 9px; color: #64748b; text-transform: uppercase; display: block; font-weight: 600; margin-bottom: 2px; }
            .meta-val { font-size: 13px; font-weight: 700; color: #0f172a; }
            
            .data-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            .data-table th, .data-table td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; }
            .data-table th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; }
            .data-table .num { text-align: right; font-family: monospace; font-size: 12px; font-weight: 500; }
            
            .progress-bar-print { background: #e2e8f0; height: 10px; border-radius: 5px; overflow: hidden; display: inline-block; width: 100px; margin-right: 8px; vertical-align: middle; }
            .progress-fill-print { background: #0284c7; height: 100%; }
            .progress-fill-print.ideal { background: #10b981; }
            .progress-fill-print.danger { background: #ef4444; }
            .progress-fill-print.over { background: #f59e0b; }
            
            .alerts-box { background: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; margin-top: 12px; border: 1px solid #e2e8f0; border-left-width: 4px; }
            .alerts-box ul { margin: 0; padding-left: 16px; }
            .alerts-box li { margin-bottom: 4px; font-size: 12px; color: #334155; }
            
            .footer-disclaimer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 10px; color: #94a3b8; }
            
            @media print {
                body { padding: 20px; background-color: #ffffff; }
            }
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="text-align: left; vertical-align: bottom;">
                    <h1 class="brand-name">Nutri Nexus</h1>
                    <span class="powered-by">Powered by <strong>biolabs Os Healix</strong></span>
                </td>
                <td style="text-align: right; vertical-align: bottom;">
                    <h2 class="doc-title">NUTRITIONAL TELEMETRY REPORT</h2>
                    <div class="report-date">Generated: ${dateStr}</div>
                </td>
            </tr>
        </table>

        <div class="section-title">Demographic Baseline</div>
        <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Age</span><span class="meta-val">${appState.profile.age} Years</span></div>
            <div class="meta-item"><span class="meta-label">Gender</span><span class="meta-val" style="text-transform: capitalize;">${appState.profile.gender}</span></div>
            <div class="meta-item"><span class="meta-label">Height</span><span class="meta-val">${heightDisplay}</span></div>
            <div class="meta-item"><span class="meta-label">Weight</span><span class="meta-val">${weightDisplay}</span></div>
            <div class="meta-item"><span class="meta-label">BMI (Indian Consensus)</span><span class="meta-val">${bmiDisplay}</span></div>
            <div class="meta-item"><span class="meta-label">Activity Level</span><span class="meta-val" style="text-transform: capitalize;">${appState.profile.activity}</span></div>
        </div>

        <div class="section-title">Intake Telemetry vs RDA Guidelines</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Nutrient</th>
                    <th style="text-align: right;">Daily Target</th>
                    <th style="text-align: right;">Actual Intake</th>
                    <th style="text-align: right;">% Target</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${renderPrintNutrientRow("Energy", rda.energy, totals.energy, "kcal")}
                ${renderPrintNutrientRow("Protein", rda.protein, totals.protein, "g")}
                ${renderPrintNutrientRow("Total Fat", rda.fat, totals.fat, "g")}
                ${renderPrintNutrientRow("Dietary Fiber", rda.fiber, totals.fiber, "g")}
                ${renderPrintNutrientRow("Calcium", rda.calcium, totals.calcium, "mg")}
                ${renderPrintNutrientRow("Iron", rda.iron, totals.iron, "mg")}
                ${renderPrintNutrientRow("Vitamin C", rda.vitc, totals.vitc, "mg")}
            </tbody>
        </table>

        <div class="section-title">Daily Intake Ledger</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Food Item (IFCT 2017)</th>
                    <th style="text-align: right;">Quantity</th>
                    <th style="text-align: right;">Energy</th>
                    <th style="text-align: right;">Protein</th>
                    <th style="text-align: right;">Carbs</th>
                    <th style="text-align: right;">Fat</th>
                    <th style="text-align: right;">Fiber</th>
                </tr>
            </thead>
            <tbody>
                ${appState.loggedFoods.map(item => `
                    <tr>
                        <td><strong>${escapeHtml(item.name)}</strong></td>
                        <td class="num">${escapeHtml(item.displayQty || (item.qty + " g"))}</td>
                        <td class="num">${Math.round(item.energy)} kcal</td>
                        <td class="num">${item.protein.toFixed(1)}g</td>
                        <td class="num">${item.carb.toFixed(1)}g</td>
                        <td class="num">${item.fat.toFixed(1)}g</td>
                        <td class="num">${item.fiber.toFixed(1)}g</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        ${renderPrintAlerts(totals, rda)}

        <div class="footer-disclaimer">
            This telemetry report was compiled in accordance with the ICMR-NIN 2024 Dietary Guidelines for Indians and the Indian Food Composition Tables (IFCT 2017). Powered by biolabs Os Healix. This document is fit for assessment of daily nutrient intakes.
        </div>
    </body>
    </html>
    `;

    // Open a new printable window
    const printWindow = window.open("", "_blank");
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    
    // Trigger print after load
    printWindow.onload = function() {
        printWindow.print();
    };
}

function renderPrintNutrientRow(name, target, current, unit) {
    const percent = target > 0 ? Math.round((current / target) * 100) : 0;
    let statusClass = "";
    let statusText = "Under Target";

    if (percent >= 80 && percent <= 110) {
        statusClass = "ideal";
        statusText = "Optimal";
    } else if (percent > 110 && percent <= 130) {
        statusClass = "over";
        statusText = "Slight Excess";
    } else if (percent > 130) {
        statusClass = "danger";
        statusText = "Excess Limit";
    }

    const fillWidth = Math.min(percent, 100);

    return `
        <tr>
            <td><strong>${name}</strong></td>
            <td class="num">${target} ${unit}</td>
            <td class="num">${current.toFixed(1)} ${unit}</td>
            <td class="num">${percent}%</td>
            <td>
                <div class="progress-bar-print">
                    <div class="progress-fill-print ${statusClass}" style="width: ${fillWidth}%;"></div>
                </div>
                ${statusText}
            </td>
        </tr>
    `;
}

function renderPrintAlerts(totals, rda) {
    let alerts = [];
    if (rda.notes && rda.notes.length > 0) alerts.push(...rda.notes);
    if (totals.energy > rda.energy * 1.15) alerts.push("Caloric Surplus: Energy exceeds targets by over 15%.");
    if (totals.fat > rda.fat * 1.15) alerts.push(`High Fat Intake: Exceeds recommended visible fat limits (${rda.visibleFatLimit}g/day).`);
    if (totals.protein < rda.protein * 0.75) alerts.push("Protein Deficit: Total intake is below 75% of your target allowance.");
    if (totals.fiber < rda.fiber * 0.75) alerts.push("Low Fiber Intake: Fiber intake is below recommended allowance.");

    if (alerts.length === 0) return "";

    return `
        <div class="section-title">Clinical Notes & Warnings</div>
        <div class="alerts-box">
            <ul>
                ${alerts.map(a => `<li>${a}</li>`).join('')}
            </ul>
        </div>
    `;
}

// Helpers
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}



// Run bootstrap
document.addEventListener("DOMContentLoaded", init);
