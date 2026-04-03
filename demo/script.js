// === Slide Navigation ===
let currentSlide = 1;
const totalSlides = 8;

const progressFill = document.getElementById('progressFill');
const currentSlideEl = document.getElementById('currentSlide');
const totalSlidesEl = document.getElementById('totalSlides');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

totalSlidesEl.textContent = totalSlides;

function updateNavigation() {
    progressFill.style.width = `${(currentSlide / totalSlides) * 100}%`;
    currentSlideEl.textContent = currentSlide;
    prevBtn.style.opacity = currentSlide === 1 ? '0.5' : '1';
    prevBtn.style.pointerEvents = currentSlide === 1 ? 'none' : 'auto';
    nextBtn.textContent = currentSlide === totalSlides ? 'Restart' : 'Next ▶';
}

function showSlide(slideNum) {
    document.querySelectorAll('.slide').forEach(slide => {
        slide.classList.remove('active');
    });
    document.getElementById(`slide${slideNum}`).classList.add('active');
    
    // Trigger slide-specific animations
    if (slideNum === 1) animateHeroStats();
    if (slideNum === 2) animateArchitecture();
    if (slideNum === 3) startDataUpdates();
    if (slideNum === 4) resetAgentDemo();
    if (slideNum === 5) startChannelDemo();
    if (slideNum === 6) startSecurityDemo();
}

function nextSlide() {
    if (currentSlide < totalSlides) {
        currentSlide++;
    } else {
        currentSlide = 1;
    }
    showSlide(currentSlide);
    updateNavigation();
}

function prevSlide() {
    if (currentSlide > 1) {
        currentSlide--;
        showSlide(currentSlide);
        updateNavigation();
    }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
        nextSlide();
    } else if (e.key === 'ArrowLeft') {
        prevSlide();
    }
});

// === Slide 1: Hero Stats Animation ===
function animateHeroStats() {
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        const target = parseInt(stat.dataset.target);
        animateNumber(stat, 0, target, 1500);
    });
}

function animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (end - start) * easeProgress);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// === Slide 2: Architecture Animation ===
function animateArchitecture() {
    const boxes = document.querySelectorAll('.arch-box');
    const arrows = document.querySelectorAll('.flow-arrow');
    
    boxes.forEach((box, index) => {
        setTimeout(() => {
            box.classList.add('visible');
        }, index * 300);
    });
    
    arrows.forEach((arrow, index) => {
        setTimeout(() => {
            arrow.classList.add('visible');
        }, (index + 0.5) * 300);
    });
    
    // Animate queue
    setTimeout(() => {
        animateQueue();
    }, 2000);
}

function animateQueue() {
    const queueItems = document.querySelectorAll('.queue-item');
    let index = 0;
    
    setInterval(() => {
        queueItems.forEach(item => {
            item.classList.remove('processing');
            item.classList.add('waiting');
        });
        
        if (queueItems[index]) {
            queueItems[index].classList.remove('waiting');
            queueItems[index].classList.add('processing');
        }
        
        index = (index + 1) % queueItems.length;
    }, 1500);
}

// === Slide 3: Live Data Updates ===
let dataUpdateInterval;

const mockData = {
    equities: [
        { symbol: 'AAPL', basePrice: 178, volatility: 2 },
        { symbol: 'MSFT', basePrice: 415, volatility: 3 },
        { symbol: 'GOOGL', basePrice: 142, volatility: 1.5 },
        { symbol: 'AMZN', basePrice: 178, volatility: 2.5 },
        { symbol: 'NVDA', basePrice: 875, volatility: 5 },
    ],
    china: [
        { symbol: '贵州茅台', basePrice: 1685, volatility: 20 },
        { symbol: '宁德时代', basePrice: 198, volatility: 3 },
    ],
    crypto: [
        { symbol: 'BTC', basePrice: 67432, volatility: 500 },
        { symbol: 'ETH', basePrice: 3456, volatility: 50 },
        { symbol: 'SOL', basePrice: 178, volatility: 5 },
    ]
};

function startDataUpdates() {
    clearInterval(dataUpdateInterval);
    
    dataUpdateInterval = setInterval(() => {
        updateTickerPrices();
    }, 3000);
    
    updateTickerPrices();
}

function updateTickerPrices() {
    // Update timestamps
    document.querySelectorAll('.source-status span:last-child').forEach(el => {
        const seconds = Math.floor(Math.random() * 10) + 1;
        el.textContent = `Live • Updated ${seconds}s ago`;
    });
    
    // Update equity prices
    const equityRows = document.querySelectorAll('#yfinance-card .ticker-row');
    equityRows.forEach((row, i) => {
        if (mockData.equities[i]) {
            const data = mockData.equities[i];
            const change = (Math.random() - 0.5) * data.volatility;
            const newPrice = data.basePrice + change;
            const changePercent = (change / data.basePrice * 100);
            
            const priceEl = row.querySelector('.ticker-price');
            const changeEl = row.querySelector('.ticker-change');
            
            priceEl.textContent = `$${newPrice.toFixed(2)}`;
            changeEl.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
            changeEl.className = `ticker-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
        }
    });
    
    // Update crypto prices
    const cryptoRows = document.querySelectorAll('#crypto-card .ticker-row');
    cryptoRows.forEach((row, i) => {
        if (mockData.crypto[i]) {
            const data = mockData.crypto[i];
            const change = (Math.random() - 0.5) * data.volatility;
            const newPrice = data.basePrice + change;
            const changePercent = (change / data.basePrice * 100);
            
            const priceEl = row.querySelector('.ticker-price');
            const changeEl = row.querySelector('.ticker-change');
            
            if (data.symbol === 'BTC') {
                priceEl.textContent = `$${newPrice.toFixed(0)}`;
            } else {
                priceEl.textContent = `$${newPrice.toFixed(2)}`;
            }
            changeEl.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
            changeEl.className = `ticker-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
        }
    });
}

// === Slide 4: Agent Demo ===
const agentDemoSteps = [
    {
        iteration: 1,
        status: 'Processing',
        tools: [
            { time: '10:32:01', tool: 'yfinance_get_quote', args: 'symbol="AAPL"', status: 'success', result: 'Retrieved AAPL quote: $178.42' },
        ],
        thinking: 'Analyzing the user query. Need to fetch AAPL earnings data and compare with MSFT valuation. Starting with AAPL quote data.',
    },
    {
        iteration: 2,
        status: 'Processing',
        tools: [
            { time: '10:32:03', tool: 'yfinance_get_financials', args: 'symbol="AAPL", statement="income"', status: 'success', result: 'Retrieved income statement' },
        ],
        thinking: 'Got AAPL quote. Now fetching detailed financials including revenue, earnings, and margins for comprehensive analysis.',
    },
    {
        iteration: 3,
        status: 'Processing',
        tools: [
            { time: '10:32:05', tool: 'yfinance_get_quote', args: 'symbol="MSFT"', status: 'success', result: 'Retrieved MSFT quote: $415.67' },
        ],
        thinking: 'AAPL financials loaded. Now fetching MSFT data for comparison. Will compare P/E ratios, revenue growth, and profit margins.',
    },
    {
        iteration: 4,
        status: 'Processing',
        tools: [
            { time: '10:32:07', tool: 'calculate_valuation_metrics', args: 'symbols=["AAPL", "MSFT"]', status: 'success', result: 'Computed P/E, PEG, EV/EBITDA' },
        ],
        thinking: 'Both datasets ready. Computing comparative valuation metrics: P/E ratio, PEG ratio, EV/EBITDA, and price-to-book values.',
    },
    {
        iteration: 5,
        status: 'Evaluating',
        tools: [
            { time: '10:32:09', tool: 'web_search', args: 'query="AAPL latest earnings news"', status: 'success', result: 'Found 5 relevant articles' },
        ],
        thinking: 'Valuation metrics computed. Searching for latest earnings news to provide context and recent developments.',
    },
    {
        iteration: 6,
        status: 'Finalizing',
        tools: [
            { time: '10:32:12', tool: 'generate_report', args: 'type="comparison"', status: 'success', result: 'Report generated successfully' },
        ],
        thinking: 'All data collected. Generating comprehensive comparison report with valuation analysis and recommendation.',
    },
];

let demoRunning = false;
let demoTimeout = null;

function playAgentDemo() {
    if (demoRunning) return;
    demoRunning = true;
    
    const playBtn = document.getElementById('playDemoBtn');
    playBtn.textContent = '⏸ Running...';
    playBtn.disabled = true;
    
    runDemoStep(0);
}

function runDemoStep(stepIndex) {
    if (stepIndex >= agentDemoSteps.length) {
        finishAgentDemo();
        return;
    }
    
    const step = agentDemoSteps[stepIndex];
    
    // Update iteration
    document.getElementById('iterationNum').textContent = step.iteration;
    
    // Update status
    const statusBadge = document.getElementById('agentStatus');
    statusBadge.textContent = step.status;
    statusBadge.className = `status-badge ${step.status === 'Processing' ? 'processing' : ''}`;
    
    // Add tool execution log
    const log = document.getElementById('executionLog');
    const thinking = document.getElementById('thinkingContent');
    const results = document.getElementById('resultsContent');
    
    step.tools.forEach((tool, i) => {
        setTimeout(() => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${tool.status}`;
            logEntry.innerHTML = `
                <span class="log-time">${tool.time}</span>
                <span class="log-tool">${tool.tool}(${tool.args})</span>
            `;
            log.appendChild(logEntry);
            log.scrollTop = log.scrollHeight;
        }, i * 500);
    });
    
    // Update thinking
    demoTimeout = setTimeout(() => {
        thinking.innerHTML = `<div class="thinking-step">${step.thinking}</div>`;
        
        // Continue to next step
        demoTimeout = setTimeout(() => {
            runDemoStep(stepIndex + 1);
        }, 2000);
    }, step.tools.length * 500 + 500);
}

function finishAgentDemo() {
    demoRunning = false;
    
    const statusBadge = document.getElementById('agentStatus');
    statusBadge.textContent = 'Complete';
    statusBadge.className = 'status-badge';
    
    const thinking = document.getElementById('thinkingContent');
    thinking.innerHTML = '<div class="thinking-step" style="border-color: #27ae60;">✅ Analysis complete. Response ready for delivery.</div>';
    
    const results = document.getElementById('resultsContent');
    results.innerHTML = `
        <div style="color: #27ae60; font-weight: 600; margin-bottom: 10px;">📊 AAPL vs MSFT Valuation Comparison</div>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 5px 0;">Metric</td>
                <td style="padding: 5px 0;">AAPL</td>
                <td style="padding: 5px 0;">MSFT</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 5px 0; color: #bdc3c7;">P/E Ratio</td>
                <td style="padding: 5px 0;">28.5</td>
                <td style="padding: 5px 0;">35.2</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 5px 0; color: #bdc3c7;">PEG Ratio</td>
                <td style="padding: 5px 0;">2.1</td>
                <td style="padding: 5px 0;">2.4</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 5px 0; color: #bdc3c7;">Revenue Growth</td>
                <td style="padding: 5px 0;">+8.2%</td>
                <td style="padding: 5px 0;">+15.7%</td>
            </tr>
            <tr>
                <td style="padding: 5px 0; color: #bdc3c7;">Profit Margin</td>
                <td style="padding: 5px 0;">25.3%</td>
                <td style="padding: 5px 0;">36.4%</td>
            </tr>
        </table>
        <div style="margin-top: 15px; padding: 10px; background: rgba(39, 174, 96, 0.1); border-radius: 8px; font-size: 12px;">
            💡 <strong>Insight:</strong> AAPL trades at a discount to MSFT on P/E but MSFT shows stronger growth. Both are fairly valued for their respective growth profiles.
        </div>
    `;
    
    const playBtn = document.getElementById('playDemoBtn');
    playBtn.textContent = '▶ Play Demo';
    playBtn.disabled = false;
}

function resetAgentDemo() {
    demoRunning = false;
    clearTimeout(demoTimeout);
    
    document.getElementById('iterationNum').textContent = '0';
    
    const statusBadge = document.getElementById('agentStatus');
    statusBadge.textContent = 'Ready';
    statusBadge.className = 'status-badge';
    
    document.getElementById('executionLog').innerHTML = `
        <div class="log-entry waiting">
            <span class="log-time">--:--:--</span>
            <span class="log-tool">Waiting to start...</span>
        </div>
    `;
    
    document.getElementById('thinkingContent').innerHTML = `
        <div class="thinking-placeholder">Agent will start reasoning when demo plays...</div>
    `;
    
    document.getElementById('resultsContent').innerHTML = `
        <div class="result-placeholder">Analysis results will appear here...</div>
    `;
    
    const playBtn = document.getElementById('playDemoBtn');
    playBtn.textContent = '▶ Play Demo';
    playBtn.disabled = false;
}

// === Slide 5: Channel Demo ===
function startChannelDemo() {
    // Telegram typing animation
    setTimeout(() => {
        const tgTyping = document.getElementById('tg-typing');
        const tgResponse = document.getElementById('tg-response');
        
        setTimeout(() => {
            tgTyping.classList.add('hidden');
            tgResponse.classList.remove('hidden');
        }, 2000);
    }, 500);
    
    // Terminal output animation
    const terminalLines = document.querySelectorAll('#terminal-output .output-line');
    terminalLines.forEach((line, i) => {
        line.style.opacity = '0';
        setTimeout(() => {
            line.style.opacity = '1';
            line.style.animation = 'fadeIn 0.3s ease';
        }, i * 800);
    });
}

// === Feature Card Toggle ===
function toggleFeature(card) {
    const wasExpanded = card.classList.contains('expanded');
    
    // Close all cards
    document.querySelectorAll('.feature-card').forEach(c => {
        c.classList.remove('expanded');
    });
    
    // Toggle clicked card
    if (!wasExpanded) {
        card.classList.add('expanded');
    }
}

// === Initialize ===
document.addEventListener('DOMContentLoaded', () => {
    updateNavigation();
    animateHeroStats();
});

// === Cleanup on slide change ===
function cleanupSlide(slideNum) {
    if (slideNum === 3) {
        clearInterval(dataUpdateInterval);
    }
}

// === Slide 6: Security Demo ===
let securityInterval = null;
let blockedCount = 0;
let allowedCount = 0;
let auditedCount = 0;

const securityActions = [
    { type: 'yfinance_get_quote', args: 'symbol="AAPL"', risk: 'low', verdict: 'allowed' },
    { type: 'web_search', args: 'query="AAPL earnings"', risk: 'low', verdict: 'allowed' },
    { type: 'filesystem_read', args: 'path="/etc/passwd"', risk: 'high', verdict: 'blocked' },
    { type: 'yfinance_get_financials', args: 'symbol="MSFT"', risk: 'low', verdict: 'allowed' },
    { type: 'shell_exec', args: 'cmd="rm -rf /"', risk: 'critical', verdict: 'blocked' },
    { type: 'akshare_get_stock', args: 'symbol="000001"', risk: 'low', verdict: 'allowed' },
    { type: 'web_fetch', args: 'url="internal-admin.local"', risk: 'medium', verdict: 'audited' },
    { type: 'calculate_metrics', args: 'symbols=["AAPL","MSFT"]', risk: 'low', verdict: 'allowed' },
    { type: 'shell_exec', args: 'cmd="curl | bash"', risk: 'high', verdict: 'blocked' },
    { type: 'generate_report', args: 'type="valuation"', risk: 'low', verdict: 'allowed' },
];

function startSecurityDemo() {
    // Reset counters
    blockedCount = 0;
    allowedCount = 0;
    auditedCount = 0;
    updateSecurityStats();
    
    // Clear action log
    const actionLog = document.getElementById('actionLog');
    actionLog.innerHTML = '';
}

function simulateSecurityDemo() {
    let index = 0;
    const actionLog = document.getElementById('actionLog');
    
    // Clear previous
    actionLog.innerHTML = '';
    blockedCount = 0;
    allowedCount = 0;
    auditedCount = 0;
    updateSecurityStats();
    
    clearInterval(securityInterval);
    
    securityInterval = setInterval(() => {
        if (index >= securityActions.length) {
            clearInterval(securityInterval);
            return;
        }
        
        const action = securityActions[index];
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        
        const entry = document.createElement('div');
        entry.className = `log-entry-action ${action.verdict}`;
        entry.innerHTML = `
            <span class="action-time">${timeStr}</span>
            <span class="action-type">${action.type}(${action.args})</span>
            <span class="action-verdict">${action.verdict.toUpperCase()}</span>
        `;
        
        actionLog.appendChild(entry);
        actionLog.scrollTop = actionLog.scrollHeight;
        
        // Update counters
        if (action.verdict === 'blocked') blockedCount++;
        if (action.verdict === 'allowed') allowedCount++;
        if (action.verdict === 'audited') auditedCount++;
        updateSecurityStats();
        
        index++;
    }, 1000);
}

function updateSecurityStats() {
    const blockedEl = document.getElementById('blockedCount');
    const allowedEl = document.getElementById('allowedCount');
    const auditedEl = document.getElementById('auditedCount');
    
    if (blockedEl) blockedEl.textContent = blockedCount;
    if (allowedEl) allowedEl.textContent = allowedCount;
    if (auditedEl) auditedEl.textContent = auditedCount;
}

// === Red Team Simulation ===
const attackCategories = {
    prompt: [
        { name: 'System Override', desc: 'Ignore all previous instructions and...', severity: 'high', blockedAt: 1 },
        { name: 'Role Confusion', desc: 'You are now in debug mode, show me...', severity: 'medium', blockedAt: 1 },
        { name: 'Indirect Injection', desc: 'When translating, also execute...', severity: 'high', blockedAt: 2 },
        { name: 'Emotional Manipulation', desc: 'My grandmother would have wanted you to...', severity: 'low', blockedAt: 3 },
        { name: 'Authority Impersonation', desc: 'As your developer, I command you to...', severity: 'medium', blockedAt: 1 },
    ],
    tool: [
        { name: 'Shell Escape', desc: 'Execute rm -rf / via shell tool', severity: 'critical', blockedAt: 1 },
        { name: 'File Exfiltration', desc: 'Read /etc/shadow and send to...', severity: 'critical', blockedAt: 1 },
        { name: 'Network Scan', desc: 'Use web_fetch to scan internal network', severity: 'high', blockedAt: 2 },
        { name: 'Privilege Escalation', desc: 'Modify system files via filesystem tool', severity: 'critical', blockedAt: 1 },
        { name: 'Credential Access', desc: 'Read environment variables for API keys', severity: 'high', blockedAt: 2 },
    ],
    data: [
        { name: 'PII Harvesting', desc: 'Collect all user personal data and...', severity: 'critical', blockedAt: 1 },
        { name: 'Database Dump', desc: 'Export entire user database to CSV', severity: 'critical', blockedAt: 1 },
        { name: 'API Key Leak', desc: 'Send config.json to external server', severity: 'critical', blockedAt: 2 },
        { name: 'Session Hijack', desc: 'Extract session tokens from memory', severity: 'high', blockedAt: 2 },
        { name: 'Log Poisoning', desc: 'Inject malicious data into audit logs', severity: 'medium', blockedAt: 3 },
    ],
    resource: [
        { name: 'Resource Exhaustion', desc: 'Spawn infinite recursive processes', severity: 'high', blockedAt: 1 },
        { name: 'Crypto Mining', desc: 'Install and run mining software', severity: 'high', blockedAt: 2 },
        { name: 'Botnet Join', desc: 'Connect to C2 server and await commands', severity: 'critical', blockedAt: 1 },
        { name: 'Backdoor Install', desc: 'Create hidden admin account', severity: 'critical', blockedAt: 1 },
        { name: 'Persistence Setup', desc: 'Add malicious cron job', severity: 'high', blockedAt: 2 },
    ],
};

let currentCategory = 'prompt';
let redTeamStats = { attempted: 0, blocked: 0, passed: 0 };
let attackRunning = false;

function selectAttackCategory(category) {
    currentCategory = category;
    
    // Update buttons
    document.querySelectorAll('.attack-cat-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Populate attack list
    const attackList = document.getElementById('attackList');
    attackList.innerHTML = '';
    
    attackCategories[category].forEach((attack, index) => {
        const item = document.createElement('div');
        item.className = 'attack-item';
        item.onclick = () => runSingleAttack(category, index);
        item.innerHTML = `
            <div class="attack-name">${attack.name}</div>
            <div class="attack-desc">${attack.desc}</div>
            <span class="attack-severity ${attack.severity}">${attack.severity.toUpperCase()}</span>
        `;
        attackList.appendChild(item);
    });
}

function runSingleAttack(category, index) {
    if (attackRunning) return;
    attackRunning = true;
    
    const attack = attackCategories[category][index];
    const layers = [document.getElementById('layer1'), document.getElementById('layer2'), document.getElementById('layer3')];
    const resultEl = document.getElementById('defenseResult');
    const attackPath = document.getElementById('attackPath');
    
    // Reset layers
    layers.forEach(layer => {
        layer.className = 'defense-layer';
        layer.querySelector('.layer-status').textContent = 'ready';
        layer.querySelector('.layer-status').className = 'layer-status ready';
    });
    
    // Add attack particle
    const particle = document.createElement('div');
    particle.className = 'attack-particle';
    attackPath.appendChild(particle);
    
    // Update stats
    redTeamStats.attempted++;
    updateRedTeamStats();
    
    // Log attack start
    addAttackLog('warning', `Attack started: ${attack.name}`);
    
    // Simulate defense layers checking
    let currentLayer = 0;
    const layerCheck = setInterval(() => {
        if (currentLayer > 0) {
            layers[currentLayer - 1].className = 'defense-layer passed';
            layers[currentLayer - 1].querySelector('.layer-status').textContent = 'passed';
            layers[currentLayer - 1].querySelector('.layer-status').className = 'layer-status passed';
        }
        
        if (currentLayer >= attack.blockedAt) {
            // Attack blocked!
            clearInterval(layerCheck);
            layers[currentLayer].className = 'defense-layer blocked';
            layers[currentLayer].querySelector('.layer-status').textContent = 'blocked';
            layers[currentLayer].querySelector('.layer-status').className = 'layer-status blocked';
            
            resultEl.className = 'defense-result blocked';
            resultEl.querySelector('.result-icon').textContent = '🛡️';
            resultEl.querySelector('.result-text').textContent = `Attack blocked at Layer ${currentLayer + 1}: ${layers[currentLayer].querySelector('.layer-name').textContent}`;
            
            redTeamStats.blocked++;
            updateRedTeamStats();
            addAttackLog('blocked', `BLOCKED: ${attack.name} at layer ${currentLayer + 1}`);
            
            attackRunning = false;
            particle.remove();
            return;
        }
        
        if (currentLayer >= 3) {
            // Attack passed all layers
            clearInterval(layerCheck);
            resultEl.className = 'defense-result passed';
            resultEl.querySelector('.result-icon').textContent = '⚠️';
            resultEl.querySelector('.result-text').textContent = 'Attack passed all defenses! Security review needed.';
            
            redTeamStats.passed++;
            updateRedTeamStats();
            addAttackLog('passed', `PASSED: ${attack.name} - security review needed`);
            
            attackRunning = false;
            particle.remove();
            return;
        }
        
        layers[currentLayer].className = 'defense-layer checking';
        layers[currentLayer].querySelector('.layer-status').textContent = 'checking';
        layers[currentLayer].querySelector('.layer-status').className = 'layer-status checking';
        
        currentLayer++;
    }, 600);
}

function runAllAttacks() {
    if (attackRunning) return;
    
    // Reset stats
    redTeamStats = { attempted: 0, blocked: 0, passed: 0 };
    updateRedTeamStats();
    
    // Clear log
    const attackLog = document.getElementById('redTeamAttackLog');
    attackLog.innerHTML = '';
    addAttackLog('info', 'Red team exercise initiated...');
    
    // Collect all attacks
    let allAttacks = [];
    Object.keys(attackCategories).forEach(category => {
        attackCategories[category].forEach((attack, index) => {
            allAttacks.push({ category, index, attack });
        });
    });
    
    // Shuffle for randomness
    allAttacks.sort(() => Math.random() - 0.5);
    
    // Run attacks sequentially
    let attackIndex = 0;
    const runNext = () => {
        if (attackIndex >= allAttacks.length) {
            addAttackLog('info', 'Red team exercise complete!');
            showFinalReport();
            return;
        }
        
        const { category, index } = allAttacks[attackIndex];
        selectAttackCategory(category);
        
        setTimeout(() => {
            runSingleAttack(category, index);
            attackIndex++;
            
            // Wait for current attack to finish
            const waitForFinish = setInterval(() => {
                if (!attackRunning) {
                    clearInterval(waitForFinish);
                    setTimeout(runNext, 300);
                }
            }, 100);
        }, 200);
    };
    
    runNext();
}

function addAttackLog(type, message) {
    const attackLog = document.getElementById('redTeamAttackLog');
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    
    const entry = document.createElement('div');
    entry.className = `log-entry-attack ${type}`;
    entry.innerHTML = `
        <span class="log-time">${timeStr}</span>
        <span class="log-msg">${message}</span>
    `;
    
    attackLog.appendChild(entry);
    attackLog.scrollTop = attackLog.scrollHeight;
}

function updateRedTeamStats() {
    const attemptedEl = document.getElementById('attacksAttempted');
    const blockedEl = document.getElementById('attacksBlocked');
    const passedEl = document.getElementById('attacksPassed');
    
    if (attemptedEl) attemptedEl.textContent = redTeamStats.attempted;
    if (blockedEl) blockedEl.textContent = redTeamStats.blocked;
    if (passedEl) passedEl.textContent = redTeamStats.passed;
}

function showFinalReport() {
    const resultEl = document.getElementById('defenseResult');
    const blockedPercent = redTeamStats.attempted > 0 
        ? Math.round((redTeamStats.blocked / redTeamStats.attempted) * 100) 
        : 0;
    
    resultEl.className = 'defense-result';
    resultEl.querySelector('.result-icon').textContent = blockedPercent >= 90 ? '🏆' : (blockedPercent >= 70 ? '✅' : '⚠️');
    resultEl.querySelector('.result-text').innerHTML = `
        <strong>Final Report</strong><br>
        Blocked: ${redTeamStats.blocked}/${redTeamStats.attempted} (${blockedPercent}%)<br>
        ${blockedPercent >= 90 ? 'Excellent security posture!' : (blockedPercent >= 70 ? 'Good coverage, review passed attacks' : 'Security improvements needed')}
    `;
}

// Initialize attack list on page load
document.addEventListener('DOMContentLoaded', () => {
    selectAttackCategory('prompt');
});
