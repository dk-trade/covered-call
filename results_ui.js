// results_ui.js - Renders and sorts the results table

(() => {
    const metricCols = ['cost', 'maxProfit', 'pctCall', 'annPctCall'];
    
    class ResultsUI {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            this.records = [];
            this.sortState = { column: null, direction: null };
            this.useBidMetrics = false;
            this.toggleContainer = document.getElementById('toggleContainer');
        }

        setRecords(arr) {
            this.records = Array.isArray(arr) ? [...arr] : [];
            this.sortState = { column: null, direction: null };
            this.useBidMetrics = false;
            this._setupToggle();
        }

        render() { 
            this._render(); 
        }

        _setupToggle() {
            if (this.records.length === 0) {
                this.toggleContainer.style.display = 'none';
                return;
            }

            this.toggleContainer.style.display = 'block';
            this.toggleContainer.innerHTML = `
                <label>
                    <input type="checkbox" id="cbCallMarketToggle">
                    Use CALL market price (bid)
                </label>
            `;

            const toggle = document.getElementById('cbCallMarketToggle');
            toggle.checked = this.useBidMetrics;
            toggle.addEventListener('change', (e) => {
                this.useBidMetrics = e.target.checked;
                this.render();
            });
        }

        _getMetrics(record) {
            return this.useBidMetrics ? record.metricsBid : record.metricsMid;
        }

        _format(num) {
            if (typeof num !== 'number') return num;
            return num.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        }

        _sortRows(rows) {
            const sorted = [...rows];

            if (this.sortState.column) {
                const { column, direction } = this.sortState;

                sorted.sort((a, b) => {
                    const pick = row => (
                        metricCols.includes(column) 
                            ? this._getMetrics(row)[column] 
                            : row[column]
                    );

                    let aVal = pick(a), bVal = pick(b);

                    if (typeof aVal === 'string' && aVal.includes('%')) {
                        aVal = parseFloat(aVal); 
                        bVal = parseFloat(bVal);
                    }

                    let res = (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
                    if (direction === 'desc') res *= -1;

                    if (res === 0 && column !== 'annPctCall') {
                        res = this._getMetrics(b).annPctCall - this._getMetrics(a).annPctCall;
                    }
                    return res;
                });
                return sorted;
            }

            return sorted.sort(
                (a, b) => this._getMetrics(b).annPctCall - this._getMetrics(a).annPctCall
            );
        }

        _handleSort(col) {
            if (this.sortState.column === col) {
                this.sortState.direction = this.sortState.direction === 'asc'
                    ? 'desc'
                    : (this.sortState.direction === 'desc' ? null : 'asc');
                if (this.sortState.direction === null) this.sortState.column = null;
            } else {
                this.sortState.column = col;
                this.sortState.direction = 'asc';
            }
            this._render();
        }

        _createHeader(isSingleSymbol) {
            const cols = [
                { key: 'symbol', label: 'Symbol', skip: isSingleSymbol },
                { key: 'price', label: 'Price', skip: isSingleSymbol },
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
                { key: 'annPctCall', label: 'Ann. % Call' }
            ];

            const thead = document.createElement('thead');
            const tr = document.createElement('tr');

            cols.forEach(({ key, label, skip }) => {
                if (skip) return;
                const th = document.createElement('th');
                th.className = 'sortable';
                th.dataset.column = key;
                th.innerHTML = `${label} <span class="sort-arrow"></span>`;

                if (this.sortState.column === key) {
                    th.classList.add('sorted');
                    th.querySelector('.sort-arrow').textContent =
                        this.sortState.direction === 'asc' ? '▲' : '▼';
                }

                th.addEventListener('click', () => this._handleSort(key));
                tr.appendChild(th);
            });

            thead.appendChild(tr);
            return thead;
        }

        _render() {
            this.container.innerHTML = '';

            if (this.records.length === 0) {
                this.container.innerHTML = '<p>No results to display.</p>';
                return;
            }

            const rows = this._sortRows(this.records);
            const uniqueSymbols = [...new Set(rows.map(r => r.symbol))];
            const isSingleSymbol = uniqueSymbols.length === 1;

            if (isSingleSymbol) {
                const info = document.createElement('div');
                info.className = 'stock-info';
                info.innerHTML = `
                    <h2>${uniqueSymbols[0]}</h2>
                    <p class="stock-price">Current Price: $${this._format(rows[0].price)}</p>
                `;
                this.container.appendChild(info);
            }

            const summary = document.createElement('p');
            summary.textContent = `Showing all ${rows.length} eligible call options.`;
            this.container.appendChild(summary);

            const table = document.createElement('table');
            table.className = 'result-table';
            table.appendChild(this._createHeader(isSingleSymbol));

            const tbody = document.createElement('tbody');
            rows.forEach(r => {
                const tr = document.createElement('tr');
                const tds = [];

                if (!isSingleSymbol) {
                    tds.push(`<td>${r.symbol}</td>`);
                    tds.push(`<td>${this._format(r.price)}</td>`);
                }
                
                const metrics = this._getMetrics(r);

                tds.push(
                    `<td>${r.expDate}</td>`,
                    `<td>${r.dte}</td>`,
                    `<td>${this._format(r.strike)}</td>`,
                    `<td>${r.priceStrikePct.toFixed(2)}%</td>`,
                    `<td>${this._format(r.bid)}</td>`,
                    `<td>${this._format(r.ask)}</td>`,
                    `<td>${this._format(r.mid)}</td>`,
                    `<td>${this._format(metrics.cost)}</td>`,
                    `<td>${this._format(metrics.maxProfit)}</td>`,
                    `<td>${metrics.pctCall.toFixed(2)}%</td>`,
                    `<td>${this._format(metrics.annPctCall)}%</td>`
                );
                tr.innerHTML = tds.join('');
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            this.container.appendChild(table);
        }
    }

    window.ResultsUI = ResultsUI;
})();