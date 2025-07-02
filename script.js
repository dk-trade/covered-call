document.addEventListener('DOMContentLoaded', () => {
  // Sort state: { column: string, direction: 'asc'|'desc'|null }
  let sortState = { column: null, direction: null };
  
  // All fetched records for re-sorting
  let allFetchedRecords = [];
  
  // Initialize saved stocks from localStorage
  let savedStocks = JSON.parse(localStorage.getItem('savedStocks') || '[]');
  
  // Restore token if saved
  const saved = localStorage.getItem('apiToken');
  if (saved) document.getElementById('apiToken').value = saved;

  // Number formatting function
  const formatNumber = (num) => {
    if (typeof num !== 'number') return num;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Create stock input section
  function createStockInputSection() {
    const container = document.getElementById('tradeForm');
    const stockSection = document.createElement('div');
    stockSection.className = 'stock-input-section';
    stockSection.innerHTML = `
      <div class="manual-stocks">
        <h3>Enter Stocks</h3>
        <div id="stockInputs">
          <div class="stock-input-row">
            <input type="text" class="stock-input" maxlength="7" placeholder="e.g., AAPL">
            <label class="save-label" style="display: none;"><input type="checkbox" class="save-stock-cb"> Save</label>
          </div>
        </div>
        <button type="button" id="addStockBtn" class="add-stock-btn">+ Add More</button>
      </div>
      
      <div class="saved-stocks-section">
        <h3>Saved Stocks</h3>
        <div id="savedStocks" class="stock-checkboxes"></div>
      </div>
    `;
    
    // Insert after API token field
    const apiGroup = container.querySelector('.form-group');
    apiGroup.after(stockSection);
    
    // Remove old symbol input
    const oldSymbolGroup = container.querySelector('label:has(#symbol)').parentElement;
    oldSymbolGroup.remove();
    
    // Initial render of saved stocks
    renderSavedStocks();
    
    // Add stock button handler
    document.getElementById('addStockBtn').addEventListener('click', addStockInput);
    
    // Add input handler for first input
    const firstInput = container.querySelector('.stock-input');
    firstInput.addEventListener('input', handleStockInputChange);
  }

  // Handle input change to show/hide save button
  function handleStockInputChange(e) {
    const saveLabel = e.target.parentElement.querySelector('.save-label');
    if (e.target.value.trim()) {
      saveLabel.style.display = 'inline-flex';
    } else {
      saveLabel.style.display = 'none';
      // Uncheck if input is cleared
      const checkbox = saveLabel.querySelector('.save-stock-cb');
      if (checkbox) checkbox.checked = false;
    }
  }

  // Add new stock input row
  function addStockInput() {
    const container = document.getElementById('stockInputs');
    const row = document.createElement('div');
    row.className = 'stock-input-row';
    row.innerHTML = `
      <input type="text" class="stock-input" maxlength="7" placeholder="e.g., AAPL">
      <label class="save-label" style="display: none;"><input type="checkbox" class="save-stock-cb"> Save</label>
      <button type="button" class="remove-input-btn">×</button>
    `;
    container.appendChild(row);
    
    // Add input handler
    const input = row.querySelector('.stock-input');
    input.addEventListener('input', handleStockInputChange);
    
    // Remove button handler
    row.querySelector('.remove-input-btn').addEventListener('click', () => {
      row.remove();
    });
  }

  // Render saved stocks with remove buttons
  function renderSavedStocks() {
    const savedDiv = document.getElementById('savedStocks');
    savedDiv.innerHTML = '';
    
    if (savedStocks.length === 0) {
      savedDiv.innerHTML = '<span class="no-saved">No saved stocks yet. Enter a stock symbol and check "Save" to add it here.</span>';
      return;
    }
    
    savedStocks.forEach(stock => {
      const wrapper = document.createElement('div');
      wrapper.className = 'saved-stock-wrapper';
      wrapper.innerHTML = `
        <label class="stock-checkbox">
          <input type="checkbox" value="${stock}"> ${stock}
        </label>
        <button type="button" class="remove-saved-btn" data-stock="${stock}">×</button>
      `;
      savedDiv.appendChild(wrapper);
    });
    
    // Add remove handlers
    savedDiv.querySelectorAll('.remove-saved-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stock = e.target.dataset.stock;
        savedStocks = savedStocks.filter(s => s !== stock);
        localStorage.setItem('savedStocks', JSON.stringify(savedStocks));
        renderSavedStocks();
      });
    });
  }

  // Get all selected stocks
  function getSelectedStocks() {
    const stocks = new Set();
    
    // Manual inputs
    document.querySelectorAll('.stock-input').forEach((input, idx) => {
      const value = input.value.trim().toUpperCase();
      if (value) {
        stocks.add(value);
        
        // Check if should save
        const saveCheckbox = input.parentElement.querySelector('.save-stock-cb');
        if (saveCheckbox?.checked && !savedStocks.includes(value)) {
          savedStocks.push(value);
          localStorage.setItem('savedStocks', JSON.stringify(savedStocks));
        }
      }
    });
    
    // Checked saved stocks
    document.querySelectorAll('#savedStocks input:checked').forEach(cb => {
      stocks.add(cb.value);
    });
    
    return Array.from(stocks);
  }

  // Sort function
  function sortRecords(records, column, direction) {
    const sorted = [...records];
    
    sorted.sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      // Handle special cases
      if (column === 'symbol' || column === 'expDate') {
        aVal = aVal.toString();
        bVal = bVal.toString();
      } else if (typeof aVal === 'string' && aVal.includes('%')) {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }
      
      let primary = 0;
      if (aVal < bVal) primary = -1;
      else if (aVal > bVal) primary = 1;
      
      if (direction === 'desc') primary *= -1;
      
      // Secondary sort by annPctCall (always descending)
      if (primary === 0 && column !== 'annPctCall') {
        return b.annPctCall - a.annPctCall;
      }
      
      return primary;
    });
    
    return sorted;
  }

  // Create sortable table header
  function createTableHeader() {
    const headers = [
      { key: 'symbol', label: 'Symbol' },
      { key: 'price', label: 'Price' },
      { key: 'expDate', label: 'Expire Date' },
      { key: 'dte', label: 'DTE' },
      { key: 'strike', label: 'Strike' },
      { key: 'priceStrikePct', label: 'Price-Strike %' },
      { key: 'bid', label: 'Bid' },
      { key: 'ask', label: 'Ask' },
      { key: 'mid', label: 'Mid' },
      { key: 'cost', label: 'Cost' },
      { key: 'maxProfit', label: 'Max Profit' },
      { key: 'pctCall', label: '% Call' },
      { key: 'annPctCall', label: 'Ann. % Call' },
      { key: 'putMid', label: 'Put Price' },
      { key: 'pctPut', label: '% Put' },
      { key: 'annPctPut', label: 'Ann. % Put' }
    ];
    
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    
    headers.forEach(({ key, label }) => {
      const th = document.createElement('th');
      th.className = 'sortable';
      th.dataset.column = key;
      th.innerHTML = `${label} <span class="sort-arrow"></span>`;
      
      th.addEventListener('click', () => handleSort(key));
      
      // Update arrow display
      if (sortState.column === key) {
        th.classList.add('sorted');
        const arrow = th.querySelector('.sort-arrow');
        arrow.textContent = sortState.direction === 'asc' ? '▲' : '▼';
      }
      
      tr.appendChild(th);
    });
    
    thead.appendChild(tr);
    return thead;
  }

  // Handle column sort
  function handleSort(column) {
    if (sortState.column === column) {
      // Cycle through: asc -> desc -> null
      if (sortState.direction === 'asc') {
        sortState.direction = 'desc';
      } else if (sortState.direction === 'desc') {
        sortState.column = null;
        sortState.direction = null;
      }
    } else {
      sortState.column = column;
      sortState.direction = 'asc';
    }
    
    // Re-render table with new sort
    renderResults();
  }

  // Render results table
  function renderResults() {
    const container = document.getElementById('resultsContainer');
    const topLines = parseInt(document.getElementById('lines').value, 10);
    
    let displayRows = [...allFetchedRecords];
    
    // Apply sort
    if (sortState.column) {
      displayRows = sortRecords(displayRows, sortState.column, sortState.direction);
    } else {
      // Default sort by annPctCall descending
      displayRows.sort((a, b) => b.annPctCall - a.annPctCall);
    }
    
    // Limit to top N
    displayRows = displayRows.slice(0, topLines);
    
    // Clear and rebuild
    container.innerHTML = '';
    
    const summary = document.createElement('p');
    summary.textContent = `Showing top ${displayRows.length} results out of ${allFetchedRecords.length} eligible calls.`;
    container.appendChild(summary);
    
    const table = document.createElement('table');
    table.className = 'result-table';
    table.appendChild(createTableHeader());
    
    const tbody = document.createElement('tbody');
    displayRows.forEach(r => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${r.symbol}</td>
        <td>${formatNumber(r.price)}</td>
        <td>${r.expDate}</td>
        <td>${r.dte}</td>
        <td>${formatNumber(r.strike)}</td>
        <td>${r.priceStrikePct.toFixed(2)}%</td>
        <td>${formatNumber(r.bid)}</td>
        <td>${formatNumber(r.ask)}</td>
        <td>${formatNumber(r.mid)}</td>
        <td>${formatNumber(r.cost)}</td>
        <td>${formatNumber(r.maxProfit)}</td>
        <td>${r.pctCall.toFixed(2)}%</td>
        <td>${formatNumber(r.annPctCall)}%</td>
        <td>${r.putMid !== '-' ? formatNumber(r.putMid) : '-'}</td>
        <td>${r.pctPut !== '-' ? r.pctPut.toFixed(2) + '%' : '-'}</td>
        <td>${r.annPctPut !== '-' ? formatNumber(r.annPctPut) + '%' : '-'}</td>
      `;
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Debug table if enabled
    if (document.getElementById('debugMode').checked && displayRows.length > 0) {
      renderDebugTable(displayRows[0]);
    }
  }

  // Render debug table
  function renderDebugTable(firstRow) {
    const container = document.getElementById('resultsContainer');
    
    const debugTitle = document.createElement('h3');
    debugTitle.textContent = 'Debug: First Row Calculations';
    debugTitle.style.marginTop = '30px';
    container.appendChild(debugTitle);

    const debugTable = document.createElement('table');
    debugTable.className = 'result-table';
    debugTable.innerHTML = `
      <thead>
        <tr>
          <th>Column</th>
          <th>Value</th>
          <th>Calculation Explanation</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const debugTbody = debugTable.querySelector('tbody');

    const debugData = [
      { column: 'Symbol', value: firstRow.symbol, explanation: 'Stock ticker symbol' },
      { column: 'Price', value: formatNumber(firstRow.price), explanation: 'Current underlying stock price from API' },
      { column: 'Expire Date', value: firstRow.expDate, explanation: `Unix timestamp ${firstRow.exp} converted to date format` },
      { column: 'DTE', value: firstRow.dte, explanation: 'Days to expiration from API' },
      { column: 'Strike', value: formatNumber(firstRow.strike), explanation: 'Strike price of the call option' },
      {
        column: 'Price-Strike %',
        value: firstRow.priceStrikePct.toFixed(2) + '%',
        explanation: `Percentage difference: ((Price - Strike) / Price) × 100 = ((${firstRow.price.toFixed(2)} - ${firstRow.strike.toFixed(2)}) / ${firstRow.price.toFixed(2)}) × 100 = ${firstRow.priceStrikePct.toFixed(2)}%`
      },
      { column: 'Bid', value: formatNumber(firstRow.bid), explanation: 'Bid price for the call option' },
      { column: 'Ask', value: formatNumber(firstRow.ask), explanation: 'Ask price for the call option' },
      {
        column: 'Mid',
        value: formatNumber(firstRow.mid),
        explanation: `Midpoint between bid and ask: (${firstRow.bid.toFixed(2)} + ${firstRow.ask.toFixed(2)}) / 2 = ${firstRow.mid.toFixed(2)}`
      },
      {
        column: 'Cost',
        value: formatNumber(firstRow.cost),
        explanation: `Net cost basis: (Stock Price - Call Premium) × 100 = (${firstRow.price.toFixed(2)} - ${firstRow.mid.toFixed(2)}) × 100 = ${firstRow.cost.toFixed(2)}`
      },
      {
        column: 'Max Profit',
        value: formatNumber(firstRow.maxProfit),
        explanation: `Maximum profit if called away: (Strike × 100) - Cost = (${firstRow.strike.toFixed(2)} × 100) - ${firstRow.cost.toFixed(2)} = ${firstRow.maxProfit.toFixed(2)}`
      },
      {
        column: '% Call',
        value: firstRow.pctCall.toFixed(2) + '%',
        explanation: `Return percentage: (Max Profit / Cost) × 100 = (${firstRow.maxProfit.toFixed(2)} / ${firstRow.cost.toFixed(2)}) × 100 = ${firstRow.pctCall.toFixed(2)}%`
      },
      {
        column: 'Ann. % Call',
        value: formatNumber(firstRow.annPctCall) + '%',
        explanation: `Annualized return: (% Call × 365) / DTE = (${firstRow.pctCall.toFixed(2)} × 365) / ${firstRow.dte} = ${firstRow.annPctCall.toFixed(2)}%`
      }
    ];

    // Add put-related calculations if available
    if (firstRow.putMid !== '-') {
      const x = firstRow.strike - firstRow.putMid;
      debugData.push(
        {
          column: 'Put Price',
          value: formatNumber(firstRow.putMid),
          explanation: 'Mid price of the corresponding put option at same strike and expiration'
        },
        {
          column: '% Put',
          value: firstRow.pctPut.toFixed(2) + '%',
          explanation: `Put return calculation: putMid / (strike - putMid) × 100 = ${firstRow.putMid.toFixed(2)} / (${firstRow.strike.toFixed(2)} - ${firstRow.putMid.toFixed(2)}) × 100 = ${firstRow.putMid.toFixed(2)} / ${x.toFixed(2)} × 100 = ${firstRow.pctPut.toFixed(2)}%`
        },
        {
          column: 'Ann. % Put',
          value: formatNumber(firstRow.annPctPut) + '%',
          explanation: `Annualized put return: (% Put × 365) / DTE = (${firstRow.pctPut.toFixed(2)} × 365) / ${firstRow.dte} = ${firstRow.annPctPut.toFixed(2)}%`
        }
      );
    } else {
      debugData.push(
        { column: 'Put Price', value: '-', explanation: 'No matching put option found at this strike and expiration' },
        { column: '% Put', value: '-', explanation: 'No put data available' },
        { column: 'Ann. % Put', value: '-', explanation: 'No put data available' }
      );
    }

    for (const item of debugData) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${item.column}</strong></td>
        <td>${item.value}</td>
        <td>${item.explanation}</td>
      `;
      debugTbody.appendChild(row);
    }

    container.appendChild(debugTable);
  }

  // Initialize stock input section
  createStockInputSection();

  // Main form submission
  document.getElementById('tradeForm').addEventListener('submit', async e => {
    e.preventDefault();

    let apiCalls = 0;
    const apiToken = document.getElementById('apiToken').value.trim();
    const pctPrice = parseFloat(document.getElementById('pctPrice').value);
    const topLines = parseInt(document.getElementById('lines').value, 10);
    const msg = document.getElementById('message');
    const container = document.getElementById('resultsContainer');

    localStorage.setItem('apiToken', apiToken);
    
    // Get selected stocks
    const stocks = getSelectedStocks();
    if (stocks.length === 0) {
      msg.textContent = 'Please select at least one stock.';
      return;
    }
    
    msg.textContent = `Loading data for ${stocks.length} stock(s)...`;
    container.innerHTML = '';
    
    // Reset sort state
    sortState = { column: null, direction: null };
    allFetchedRecords = [];

    try {
      // Process each stock
      for (const symbol of stocks) {
        // Get expirations
        apiCalls++;
        const expRes = await fetch(
          `https://api.marketdata.app/v1/options/expirations/${symbol}`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        );
        const expJson = await expRes.json();
        const expirations = expJson.expirations || [];

        if (!expirations.length) continue;

        // Get option chains
        for (const expStr of expirations) {
          apiCalls++;
          const chainRes = await fetch(
            `https://api.marketdata.app/v1/options/chain/${symbol}/?expiration=${expStr}`,
            { headers: { Authorization: `Bearer ${apiToken}` } }
          );
          const data = await chainRes.json();
          if (data.s !== 'ok' || !data.optionSymbol?.length) continue;

          const price = data.underlyingPrice[0];
          const maxStrike = price * (pctPrice / 100);

          for (let i = 0; i < data.optionSymbol.length; i++) {
            if (data.side[i] !== 'call') continue;
            if (data.strike[i] >= maxStrike) continue;

            const strike = data.strike[i];
            const mid = data.mid[i];
            const bid = data.bid[i];
            const ask = data.ask[i];
            const dte = data.dte[i];
            const exp = data.expiration[i];

            const cost = (price - mid) * 100;
            const maxProfit = (strike * 100) - cost;
            const pctCall = (maxProfit / cost) * 100;
            const annPctCall = (pctCall * 365) / dte;
            const priceStrikePct = ((price - strike) / price) * 100;

            // Find matching put
            let putMid = '-', pctPut = '-', annPctPut = '-';
            const putIdx = data.optionSymbol.findIndex(
              (_, j) =>
                data.side[j] === 'put' &&
                data.strike[j] === strike &&
                data.expiration[j] === exp
            );
            if (putIdx !== -1) {
              putMid = data.mid[putIdx];
              const x = strike - putMid;
              pctPut = (putMid / x) * 100;
              annPctPut = (pctPut * 365) / data.dte[putIdx];
            }

            allFetchedRecords.push({
              symbol,
              price,
              exp,
              expDate: new Date(exp * 1000).toLocaleDateString('en-GB'),
              dte,
              strike,
              bid,
              ask,
              mid,
              cost,
              maxProfit,
              pctCall,
              annPctCall,
              priceStrikePct,
              putMid,
              pctPut,
              annPctPut
            });
          }
        }
      }

      if (!allFetchedRecords.length) {
        msg.textContent = 'No valid call options found after filtering.';
        return;
      }

      msg.textContent = `Found ${allFetchedRecords.length} options. API calls: ${apiCalls}`;
      
      // Update saved stocks display
      renderSavedStocks();
      
      // Render results
      renderResults();

    } catch (err) {
      console.error(err);
      msg.textContent = `Error: ${err.message}. Check your API token and try again.`;
    }
  });
});
