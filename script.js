document.getElementById('tradeForm').addEventListener('submit', async function (e) {
    e.preventDefault();
  
    const symbol = document.getElementById('symbol').value.trim().toUpperCase();
    const pctPrice = parseFloat(document.getElementById('pctPrice').value);
    const lines = parseInt(document.getElementById('lines').value);
    const messageDiv = document.getElementById('message');
    const tableBody = document.querySelector('#resultTable tbody');
  
    messageDiv.textContent = '';
    tableBody.innerHTML = '';
  
    try {
      const response = await fetch(`https://api.marketdata.app/v1/options/chain/${symbol}/`);
      const data = await response.json();
  
      if (data.s !== 'ok' || !data.optionSymbol || data.optionSymbol.length === 0) {
        messageDiv.textContent = 'No data found for the provided symbol.';
        return;
      }
  
      const underlyingPrice = data.underlyingPrice[0];
      const maxStrike = underlyingPrice * (pctPrice / 100);
  
      const records = [];
  
      for (let i = 0; i < data.optionSymbol.length; i++) {
        if (data.side[i] !== 'call') continue;
        if (data.strike[i] >= maxStrike) continue;
  
        const strike = data.strike[i];
        const mid = data.mid[i];
        const dte = data.dte[i];
        const bid = data.bid[i];
        const ask = data.ask[i];
        const expiration = data.expiration[i];
  
        const cost = (underlyingPrice - mid) * 100;
        const maxProfit = (strike * 100) - cost;
        const pctCall = (maxProfit / cost) * 100;
        const annPct = (pctCall / 365) * dte;
  
        records.push({
          index: i,
          strike,
          mid,
          bid,
          ask,
          expiration,
          cost,
          maxProfit,
          pctCall,
          annPct
        });
      }
  
      records.sort((a, b) => b.annPct - a.annPct);
      const selected = records.slice(0, lines);
  
      for (const rec of selected) {
        // Find matching put
        let putIndex = -1;
        for (let j = 0; j < data.optionSymbol.length; j++) {
          if (
            data.side[j] === 'put' &&
            data.strike[j] === rec.strike &&
            data.expiration[j] === rec.expiration &&
            data.underlying[j] === symbol
          ) {
            putIndex = j;
            break;
          }
        }
  
        let putMid = '-';
        let pctPut = '-';
        let annPctPut = '-';
  
        if (putIndex !== -1) {
          putMid = data.mid[putIndex];
          pctPut = ((rec.strike - putMid) / rec.strike) * 100;
          annPctPut = (pctPut * 365) / data.dte[putIndex];
        }
  
        const expDate = new Date(rec.expiration * 1000);
        const formattedDate = `${expDate.getDate().toString().padStart(2, '0')}/${(expDate.getMonth() + 1).toString().padStart(2, '0')}/${expDate.getFullYear().toString().slice(-2)}`;
  
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${symbol}</td>
          <td>${underlyingPrice.toFixed(2)}</td>
          <td>${formattedDate}</td>
          <td>${rec.strike.toFixed(2)}</td>
          <td>${rec.bid.toFixed(2)}</td>
          <td>${rec.ask.toFixed(2)}</td>
          <td>${rec.mid.toFixed(2)}</td>
          <td>${rec.cost.toFixed(2)}</td>
          <td>${rec.maxProfit.toFixed(2)}</td>
          <td>${rec.pctCall.toFixed(2)}</td>
          <td>${rec.annPct.toFixed(2)}</td>
          <td>${putMid !== '-' ? putMid.toFixed(2) : '-'}</td>
          <td>${pctPut !== '-' ? pctPut.toFixed(2) : '-'}</td>
          <td>${annPctPut !== '-' ? annPctPut.toFixed(2) : '-'}</td>
        `;
        tableBody.appendChild(row);
      }
  
      if (selected.length === 0) {
        messageDiv.textContent = 'No valid call options found after filtering.';
      }
    } catch (error) {
      console.error(error);
      messageDiv.textContent = 'An error occurred while fetching data.';
    }
  });
  