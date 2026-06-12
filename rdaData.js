// RDA Calculations based on ICMR-NIN 2024 Guidelines
const RDA_DATA = {
    // Reference weights used if user doesn't enter weight
    REF_WEIGHTS: {
        adult_male: 65,
        adult_female: 55,
        child_1_3: 12.9,
        child_4_6: 18.3,
        child_7_9: 25.1,
        boys_10_12: 34.3,
        girls_10_12: 35.0,
        boys_13_15: 50.7,
        girls_13_15: 46.6,
        boys_16_18: 65.0,
        girls_16_18: 52.1
    },

    calculateRDA: function(profile) {
        let age = parseFloat(profile.age);
        if (isNaN(age) || age < 1) age = 1;
        if (age > 110) age = 110;

        const gender = profile.gender; // 'male' | 'female'
        const activity = profile.activity; // 'sedentary' | 'moderate' | 'heavy'
        const status = profile.status; // 'none' | 'pregnant' | 'lactation_0_6' | 'lactation_6_12'
        
        let weight = parseFloat(profile.weight);
        if (isNaN(weight) || weight <= 0) {
            weight = this.getDefaultWeight(age, gender);
        } else {
            if (weight < 2) weight = 2;
            if (weight > 250) weight = 250;
        }

        let rda = {
            energy: 2000,
            protein: 50,
            fat: 55, // total fat
            visibleFatLimit: 25, // visible fat cooking oil limit
            fiber: 30,
            calcium: 1000,
            iron: 19,
            vitc: 80,
            notes: []
        };

        // 1. Children & Toddlers (under 10 years)
        if (age < 10) {
            if (age >= 1 && age <= 3) {
                rda.energy = 1010;
                rda.protein = 12.5;
                rda.fat = (rda.energy * 0.25) / 9; // ~28g
                rda.visibleFatLimit = 15;
                rda.calcium = 500;
                rda.iron = 8;
                rda.vitc = 35;
                rda.notes.push("Values calculated for toddlers (1-3 yrs). Focus on nutrient-dense soft foods.");
            } else if (age >= 4 && age <= 6) {
                rda.energy = 1360;
                rda.protein = 16.0;
                rda.fat = (rda.energy * 0.25) / 9; // ~38g
                rda.visibleFatLimit = 20;
                rda.calcium = 600;
                rda.iron = 11;
                rda.vitc = 45;
                rda.notes.push("Values calculated for young children (4-6 yrs). Encourage active outdoor play.");
            } else if (age >= 7 && age <= 9) {
                rda.energy = 1700;
                rda.protein = 23.0;
                rda.fat = (rda.energy * 0.25) / 9; // ~47g
                rda.visibleFatLimit = 22;
                rda.calcium = 600;
                rda.iron = 15;
                rda.vitc = 45;
                rda.notes.push("Values calculated for children (7-9 yrs). Ensure adequate milk and legume intake.");
            } else {
                // Under 1 year fallback (normally handled separately but for safety)
                rda.energy = 700;
                rda.protein = 8.0;
                rda.fat = 20;
                rda.visibleFatLimit = 5;
                rda.calcium = 500;
                rda.iron = 5;
                rda.vitc = 30;
                rda.notes.push("Infants (<1 yr) rely primarily on breast milk.");
            }
        }
        // 2. Adolescents (10-18 years)
        else if (age >= 10 && age <= 18) {
            if (age >= 10 && age <= 12) {
                if (gender === 'male') {
                    rda.energy = 2220;
                    rda.protein = 32.0;
                    rda.iron = 16;
                } else {
                    rda.energy = 1900;
                    rda.protein = 33.0;
                    rda.iron = 28;
                }
                rda.calcium = 850;
                rda.vitc = 65;
                rda.notes.push("Growth spurt period. Ensure adequate iron intake especially for adolescent girls.");
            } else if (age >= 13 && age <= 15) {
                if (gender === 'male') {
                    rda.energy = 2860;
                    rda.protein = 45.0;
                    rda.iron = 22;
                } else {
                    rda.energy = 2400;
                    rda.protein = 43.0;
                    rda.iron = 30;
                }
                rda.calcium = 850;
                rda.vitc = 65;
                rda.notes.push("High energy requirements due to rapid physical development.");
            } else if (age >= 16 && age <= 18) {
                if (gender === 'male') {
                    rda.energy = 3320;
                    rda.protein = 55.0;
                    rda.iron = 26;
                } else {
                    rda.energy = 2500;
                    rda.protein = 46.0;
                    rda.iron = 28;
                }
                rda.calcium = 850;
                rda.vitc = 65;
                rda.notes.push("Active growth phase. Protein and energy requirements are peak.");
            }
            rda.fat = (rda.energy * 0.25) / 9;
            rda.visibleFatLimit = gender === 'male' ? 35 : 25;
        }
        // 3. Adults (19+ years)
        else {
            // Energy calculations based on activity level
            if (gender === 'male') {
                if (activity === 'sedentary') {
                    rda.energy = 2110;
                    rda.visibleFatLimit = 25;
                } else if (activity === 'moderate') {
                    rda.energy = 2710;
                    rda.visibleFatLimit = 30;
                } else { // heavy
                    rda.energy = 3470;
                    rda.visibleFatLimit = 40;
                }
                rda.iron = 19;
                rda.calcium = 1000;
                rda.vitc = 80;
                
                // Protein: 0.83 g/kg body weight
                rda.protein = Math.round(weight * 0.83);
                rda.notes.push(`Adult Male RDA calculated using reference weight or entered weight (${weight} kg).`);
            } else { // female
                if (activity === 'sedentary') {
                    rda.energy = 1660;
                    rda.visibleFatLimit = 20;
                } else if (activity === 'moderate') {
                    rda.energy = 2130;
                    rda.visibleFatLimit = 25;
                } else { // heavy
                    rda.energy = 2720;
                    rda.visibleFatLimit = 30;
                }
                
                // Reproductive age iron is 29mg (standard for adult females <= 50 yrs in India)
                rda.iron = age <= 50 ? 29 : 15;
                rda.calcium = 1000;
                rda.vitc = 80;
                
                // Protein: 0.83 g/kg body weight
                rda.protein = Math.round(weight * 0.83);
                rda.notes.push(`Adult Female RDA calculated using reference weight or entered weight (${weight} kg).`);

                // Adjustments for pregnancy/lactation
                if (status === 'pregnant') {
                    rda.energy += 350; // average increase
                    rda.protein += 15; // average increase
                    rda.iron = 40; // high iron requirements
                    rda.calcium = 1000;
                    rda.vitc = 85;
                    rda.visibleFatLimit = 30;
                    rda.notes.push("Pregnancy adjustment: Elevated calorie (+350 kcal), protein (+15g), and iron (40mg) requirements.");
                } else if (status === 'lactation_0_6') {
                    rda.energy += 600;
                    rda.protein += 17;
                    rda.iron = 23;
                    rda.calcium = 1000;
                    rda.vitc = 120; // High vitamin C for milk production
                    rda.visibleFatLimit = 30;
                    rda.notes.push("Lactation (0-6 months) adjustment: Very high energy (+600 kcal), protein (+17g), and Vitamin C (120mg) requirements.");
                } else if (status === 'lactation_6_12') {
                    rda.energy += 520;
                    rda.protein += 13;
                    rda.iron = 23;
                    rda.calcium = 1000;
                    rda.vitc = 120;
                    rda.visibleFatLimit = 30;
                    rda.notes.push("Lactation (6-12 months) adjustment: Elevated energy (+520 kcal), protein (+13g), and Vitamin C (120mg) requirements.");
                }
            }

            // Total fat budget is 25% of energy
            rda.fat = Math.round((rda.energy * 0.25) / 9);
        }

        // Fiber target: 30g per 2000 kcal scale, or flat 30g minimum for adults
        if (age >= 10) {
            rda.fiber = 30;
        } else {
            rda.fiber = Math.round((rda.energy / 2000) * 30);
        }

        return rda;
    },

    getDefaultWeight: function(age, gender) {
        if (age < 4) return this.REF_WEIGHTS.child_1_3;
        if (age < 7) return this.REF_WEIGHTS.child_4_6;
        if (age < 10) return this.REF_WEIGHTS.child_7_9;
        if (age < 13) return gender === 'male' ? this.REF_WEIGHTS.boys_10_12 : this.REF_WEIGHTS.girls_10_12;
        if (age < 16) return gender === 'male' ? this.REF_WEIGHTS.boys_13_15 : this.REF_WEIGHTS.girls_13_15;
        if (age <= 18) return gender === 'male' ? this.REF_WEIGHTS.boys_16_18 : this.REF_WEIGHTS.girls_16_18;
        return gender === 'male' ? this.REF_WEIGHTS.adult_male : this.REF_WEIGHTS.adult_female;
    }
};

// If using ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RDA_DATA;
}
