// calculator.js - Handles calculations and API calls

class CoveredCallCalculator {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.apiCalls = 0;
  }

  calculateDTE(expirationStr) {
    const expDate = new Date(expirationStr + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async fetchOptionsData(stocks, filters) {
    const { minStrikePct, maxStrikePct, minDte, maxDte } = filters;
    const allRecords = [];
    this.apiCalls = 0;

    for (const symbol of stocks) {
      try {
        const records = await this.fetchStockOptions(symbol, {
          minStrikePct,
          maxStrikePct,
          minDte,
          maxDte
        });
        allRecords.push(...records);
      } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error);
      }
    }

    return {
      records: allRecords,
      apiCalls: this.apiCalls
    };
  }

  async fetchStockOptions(symbol, filters) {
    const { minStrikePct, maxStrikePct, minDte, maxDte } = filters;
    const records = [];

    this.apiCalls++;
    const expRes = await fetch(
      `https://api.marketdata.app/v1/options/expirations/${symbol}`,
      { headers: { Authorization: `Bearer ${this.apiToken}` } }
    );
    
    if (!expRes.ok) throw new Error(`Failed to fetch expirations for ${symbol}`);
    
    const expJson = await expRes.json();
    const allExpirations = expJson.expirations || [];

    if (!allExpirations.length) return records;

    const filteredExpirations = allExpirations.filter(expStr => {
      const dte = this.calculateDTE(expStr);
      return dte >= minDte && dte <= maxDte;
    });

    if (!filteredExpirations.length) return records;

    this.apiCalls++;
    const firstChainRes = await fetch(
      `https://api.marketdata.app/v1/options/chain/${symbol}/?expiration=${filteredExpirations[0]}&side=call`,
      { headers: { Authorization: `Bearer ${this.apiToken}` } }
    );
    
    if (!firstChainRes.ok) throw new Error(`Failed to fetch chain data for ${symbol}`);
    
    const firstData = await firstChainRes.json();
    if (firstData.s !== 'ok' || !firstData.underlyingPrice?.length) return records;

    const price = firstData.underlyingPrice[0];
    const minStrike = Math.floor(price * (minStrikePct / 100));
    const maxStrike = Math.floor(price * (maxStrikePct / 100));

    for (const expStr of filteredExpirations) {
      this.apiCalls++;
      const chainRes = await fetch(
        `https://api.marketdata.app/v1/options/chain/${symbol}/?expiration=${expStr}&side=call&strike=${minStrike}-${maxStrike}`,
        { headers: { Authorization: `Bearer ${this.apiToken}` } }
      );
      
      if (!chainRes.ok) continue;
      
      const data = await chainRes.json();
      if (data.s !== 'ok' || !data.optionSymbol?.length) continue;

      for (let i = 0; i < data.optionSymbol.length; i++) {
        const strike = data.strike[i];
        const mid = data.mid[i];
        const bid = data.bid[i];
        const ask = data.ask[i];
        const dte = data.dte[i];
        const exp = data.expiration[i];

        if (dte < minDte || dte > maxDte) continue;

        const metrics = this.calculateMetrics(price, strike, bid, mid, dte);

        records.push({
          symbol,
          price,
          exp,
          expDate: new Date(exp * 1000).toLocaleDateString('en-GB'),
          dte,
          strike,
          bid,
          ask,
          mid,
          priceStrikePct: metrics.priceStrikePct,
          metricsMid: metrics.metricsMid,
          metricsBid: metrics.metricsBid,
        });
      }
    }

    return records;
  }

  calculateMetrics(price, strike, bid, mid, dte) {
    const priceStrikePct = 100 * (strike - price) / price;
  
    // Mid (limit) - Following document specification
    const costMid = (price - mid) * 100;
    const maxProfitMid = (strike * 100) - costMid;
    const pctCallMid = (maxProfitMid / costMid) * 100;
    const annPctMid = (pctCallMid * 365) / dte;
  
    // Bid (market) - Following document specification  
    const costBid = (price - bid) * 100;
    const maxProfitBid = (strike * 100) - costBid;
    const pctCallBid = (maxProfitBid / costBid) * 100;
    const annPctBid = (pctCallBid * 365) / dte;
  
    return {
      priceStrikePct,
      metricsMid: {
        cost: costMid,
        maxProfit: maxProfitMid,
        pctCall: pctCallMid,
        annPctCall: annPctMid,
      },
      metricsBid: {
        cost: costBid,
        maxProfit: maxProfitBid,
        pctCall: pctCallBid,
        annPctCall: annPctBid,
      },
    };
  }
}

window.CoveredCallCalculator = CoveredCallCalculator;