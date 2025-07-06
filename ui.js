// ui.js - Handles user input, sliders and API calls

document.addEventListener('DOMContentLoaded', () => {
  let savedStocks = JSON.parse(localStorage.getItem('savedStocks') || '[]');
  let calculator = null;  
  window.resultsUI = new ResultsUI('resultsContainer');

  const savedToken = localStorage.getItem('apiToken');
  if (savedToken) document.getElementById('apiToken').value = savedToken;

  function initializeRangeSliders() {
    initSlider('strike', {
      min: 0, max: 100, startMin: 30, startMax: 80,
      suffix: '%', minInputId: 'minStrike', maxInputId: 'maxStrike'
    });

    initSlider('dte', {
      min: 1, max: 365, startMin: 1, startMax: 45,
      suffix: ' days', minInputId: 'minDte', maxInputId: 'maxDte'
    });
  }

  function initSlider(sliderName, opts) {
    const rangeSlider = document.querySelector(`[data-slider="${sliderName}"]`);
    if (!rangeSlider) return;
    
    const rangeTrack = rangeSlider.querySelector('.range-track');
    const rangeSel = rangeSlider.querySelector('.range-selected');
    const minThumb = rangeSlider.querySelector('.thumb-min');
    const maxThumb = rangeSlider.querySelector('.thumb-max');
    const minInput = document.getElementById(opts.minInputId);
    const maxInput = document.getElementById(opts.maxInputId);
    const display = rangeSlider.querySelector('.range-display');

    let minVal = opts.startMin;
    let maxVal = opts.startMax;

    const update = () => {
      const pct = v => ((v - opts.min) / (opts.max - opts.min)) * 100;
      rangeSel.style.left = pct(minVal) + '%';
      rangeSel.style.width = (pct(maxVal) - pct(minVal)) + '%';
      minThumb.style.left = pct(minVal) + '%';
      maxThumb.style.left = pct(maxVal) + '%';
      minInput.value = minVal;
      maxInput.value = maxVal;
      display.textContent = sliderName === 'dte'
        ? `${minVal} - ${maxVal}${opts.suffix}`
        : `${minVal}${opts.suffix} - ${maxVal}${opts.suffix}`;
    };

    const makeDrag = (target, isMin) => e => {
      e.preventDefault();
      const startX = (e.clientX || e.touches[0].clientX);
      const start = isMin ? minVal : maxVal;
      const rect = rangeTrack.getBoundingClientRect();

      const onMove = ev => {
        const curX = (ev.clientX || ev.touches[0].clientX);
        const diffPct = ((curX - startX) / rect.width) * 100;
        const range = opts.max - opts.min;
        let val = Math.round(start + (diffPct * range / 100));

        if (isMin) {
          val = Math.max(opts.min, Math.min(val, maxVal - 1));
          minVal = val;
        } else {
          val = Math.max(minVal + 1, Math.min(val, opts.max));
          maxVal = val;
        }
        update();
      };
      const onEnd = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
    };

    minThumb.addEventListener('mousedown', makeDrag(minThumb, true));
    minThumb.addEventListener('touchstart', makeDrag(minThumb, true));
    maxThumb.addEventListener('mousedown', makeDrag(maxThumb, false));
    maxThumb.addEventListener('touchstart', makeDrag(maxThumb, false));

    rangeTrack.addEventListener('click', ev => {
      if (ev.target.classList.contains('thumb')) return;
      const rect = rangeTrack.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const val = opts.min + Math.round((pct * (opts.max - opts.min)) / 100);
      if (Math.abs(val - minVal) < Math.abs(val - maxVal)) {
        minVal = Math.max(opts.min, Math.min(val, maxVal - 1));
      } else {
        maxVal = Math.max(minVal + 1, Math.min(val, opts.max));
      }
      update();
    });

    update();
  }

  createStockInputSection();
  
  function createStockInputSection() {
    const form = document.getElementById('tradeForm');
    const sec = document.createElement('div');
    sec.className = 'stock-input-section';
    sec.innerHTML = `
      <div class="manual-stocks">
        <h3>Enter Stocks</h3>
        <div id="stockInputs">
          <div class="stock-input-row">
            <input type="text" class="stock-input" maxlength="7" placeholder="e.g., AAPL">
            <label class="save-label" style="display:none;"><input type="checkbox" class="save-stock-cb"> Save</label>
          </div>
        </div>
        <button type="button" id="addStockBtn" class="add-stock-btn">+ Add More</button>
      </div>
      <div class="saved-stocks-section">
        <h3>Saved Stocks</h3>
        <div id="savedStocks" class="stock-checkboxes"></div>
      </div>
    `;
    form.querySelector('.form-group').after(sec);
    const oldSymbolGroup = form.querySelector('label:has(#symbol)');
    if (oldSymbolGroup) oldSymbolGroup.parentElement.remove();

    document.getElementById('addStockBtn').addEventListener('click', addStockInput);
    form.querySelector('.stock-input').addEventListener('input', toggleSaveLabel);
    renderSavedStocks();
  }

  function toggleSaveLabel(e) {
    const saveLbl = e.target.parentElement.querySelector('.save-label');
    saveLbl.style.display = e.target.value.trim() ? 'inline-flex' : 'none';
    if (!e.target.value.trim()) saveLbl.querySelector('.save-stock-cb').checked = false;
  }

  function addStockInput() {
    const row = document.createElement('div');
    row.className = 'stock-input-row';
    row.innerHTML = `
      <input type="text" class="stock-input" maxlength="7" placeholder="e.g., AAPL">
      <label class="save-label" style="display:none;"><input type="checkbox" class="save-stock-cb"> Save</label>
      <button type="button" class="remove-input-btn">×</button>
    `;
    document.getElementById('stockInputs').appendChild(row);
    row.querySelector('.stock-input').addEventListener('input', toggleSaveLabel);
    row.querySelector('.remove-input-btn').addEventListener('click', () => row.remove());
  }

  function renderSavedStocks() {
    const div = document.getElementById('savedStocks');
    div.innerHTML = '';
    if (savedStocks.length === 0) {
      div.innerHTML = '<span class="no-saved">No saved stocks yet.</span>';
      return;
    }
    savedStocks.forEach(s => {
      const wrap = document.createElement('div');
      wrap.className = 'saved-stock-wrapper';
      wrap.innerHTML = `
        <label class="stock-checkbox">
          <input type="checkbox" value="${s}"> ${s}
        </label>
        <button type="button" class="remove-saved-btn" data-stock="${s}">×</button>
      `;
      div.appendChild(wrap);
    });
    div.querySelectorAll('.remove-saved-btn').forEach(btn => {
      btn.addEventListener('click', ({target}) => {
        savedStocks = savedStocks.filter(x => x !== target.dataset.stock);
        localStorage.setItem('savedStocks', JSON.stringify(savedStocks));
        renderSavedStocks();
      });
    });
  }

  function getSelectedStocks() {
    const set = new Set();
    document.querySelectorAll('.stock-input').forEach(inp => {
      const val = inp.value.trim().toUpperCase();
      if (val) {
        set.add(val);
        if (inp.parentElement.querySelector('.save-stock-cb')?.checked && !savedStocks.includes(val)) {
          savedStocks.push(val);
          localStorage.setItem('savedStocks', JSON.stringify(savedStocks));
        }
      }
    });
    document.querySelectorAll('#savedStocks input:checked').forEach(cb => set.add(cb.value));
    return Array.from(set);
  }

  initializeRangeSliders();

  document.getElementById('tradeForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('message');
    msg.textContent = '';

    const apiToken = document.getElementById('apiToken').value.trim();
    const minStrikePct = +document.getElementById('minStrike').value;
    const maxStrikePct = +document.getElementById('maxStrike').value;
    const minDte = +document.getElementById('minDte').value || 1;
    const maxDte = +document.getElementById('maxDte').value || 365;
    localStorage.setItem('apiToken', apiToken);

    const stocks = getSelectedStocks();
    if (stocks.length === 0) { 
      msg.textContent = 'Please select at least one stock.'; 
      return; 
    }

    msg.textContent = `Loading data for ${stocks.length} stock(s)…`;
    resultsUI.setRecords([]);
    resultsUI.render();

    try {
      calculator = new CoveredCallCalculator(apiToken);
      const res = await calculator.fetchOptionsData(stocks, {
        minStrikePct, maxStrikePct, minDte, maxDte
      });

      if (!res.records.length) {
        msg.textContent = 'No valid call options found after filtering.';
        return;
      }

      msg.textContent = `Found ${res.records.length} options. API calls: ${res.apiCalls}`;
      renderSavedStocks();
      resultsUI.setRecords(res.records);
      resultsUI.render();

    } catch (err) {
      console.error(err);
      msg.textContent = `Error: ${err.message}. Check your API token and try again.`;
    }
  });
});