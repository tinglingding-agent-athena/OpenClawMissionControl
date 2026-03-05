// Gateway configuration
const GATEWAY_URL = 'https://gateway.tinglingding.win';
const GATEWAY_TOKEN = '6378139186bd3e7fea3ebeb120272e4174bf320077beb9be';

let lastSyncTime = null;
let isConnected = false;

// API Status indicator elements
const apiStatusDot = document.querySelector('.status-dot');
const apiStatusText = document.querySelector('.status-text');
const lastSyncDisplay = document.getElementById('last-sync');
const refreshBtn = document.getElementById('refresh-btn');

// Update API status indicator
function updateApiStatus(connected) {
    isConnected = connected;
    if (apiStatusDot && apiStatusText) {
        if (connected) {
            apiStatusDot.style.backgroundColor = 'var(--success-green)';
            apiStatusText.textContent = 'Connected';
        } else {
            apiStatusDot.style.backgroundColor = 'var(--error-red)';
            apiStatusText.textContent = 'Disconnected';
        }
    }
}

// Update last sync timestamp
function updateLastSync() {
    lastSyncTime = new Date();
    if (lastSyncDisplay) {
        lastSyncDisplay.textContent = `Last updated: ${lastSyncTime.toLocaleTimeString()}`;
    }
}

// Fetch data from Gateway API
async function fetchGatewayData() {
    updateApiStatus(false);
    
    try {
        const response = await fetch(`${GATEWAY_URL}/api/tasks`, {
            headers: {
                'Authorization': `Bearer ${GATEWAY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        updateApiStatus(true);
        updateLastSync();
        return data;
    } catch (error) {
        console.error('Error fetching from Gateway:', error);
        updateApiStatus(false);
        // Try fallback to local data
        return fetchLocalData();
    }
}

// Fallback to local data file
async function fetchLocalData() {
    try {
        const response = await fetch('data/control_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        updateApiStatus(true);
        updateLastSync();
        return data;
    } catch (error) {
        console.error('Error loading local data:', error);
        updateApiStatus(false);
        return null;
    }
}

// Load tasks (main function)
async function loadTasks() {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('spinning');
    
    let data = await fetchGatewayData();
    
    if (!data) {
        // Show error state
        document.querySelector('.dashboard-container').innerHTML = `
            <div style="color: var(--error-red); text-align: center; padding: 50px; background: rgba(0,0,0,0.5); border-radius: 10px;">
                <h2>ERROR: Failed to load Mission Control data.</h2>
                <p>Could not connect to Gateway API or find local data.</p>
                <p>Please check your network connection and try again.</p>
            </div>
        `;
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('spinning');
        return;
    }
    
    renderDashboard(data);
    refreshBtn.disabled = false;
    refreshBtn.classList.remove('spinning');
}

document.addEventListener('DOMContentLoaded', () => {
    // Set up refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadTasks);
    }
    
    // Initial load
    loadTasks();
    
    // Auto-refresh every 60 seconds
    setInterval(loadTasks, 60000);
});

function renderDashboard(data) {
    // Agent Status
    const agentStatusText = document.getElementById('agent-status').querySelector('.text');
    if (data.agentStatus?.status === 'online' || data.agent_status?.status === 'online') {
        document.getElementById('agent-status').querySelector('.dot').style.backgroundColor = 'var(--success-green)';
        const model = data.agentStatus?.currentModel || data.agent_status?.current_model || 'Unknown';
        agentStatusText.textContent = `Agent Status: Online (${model})`;
    } else {
        document.getElementById('agent-status').querySelector('.dot').style.backgroundColor = 'var(--error-red)';
        const status = data.agentStatus?.status || data.agent_status?.status || 'Unknown';
        agentStatusText.textContent = `Agent Status: ${status}`;
    }

    // Current Task - support multiple data formats
    const currentTask = data.currentTask?.description || data.current_task?.description || data.currentFocus?.description || 'Awaiting new directives.';
    document.getElementById('current-task-display').textContent = currentTask;

    // Kanban Task View - support multiple data formats
    const queued = data.kanban?.queued || data.tasks?.queued || [];
    const inProgress = data.kanban?.inProgress || data.kanban?.in_progress || data.tasks?.in_progress || [];
    const completed = data.kanban?.completed || data.tasks?.completed || [];
    
    renderKanbanColumn('tasks-queued', queued);
    renderKanbanColumn('tasks-in-progress', inProgress);
    renderKanbanColumn('tasks-completed', completed);

    // Key Metrics - support multiple data formats
    document.getElementById('token-usage').textContent = data.metrics?.tokenUsage || data.metrics?.token_usage || data.metrics?.token_usage || 'N/A';
    document.getElementById('api-calls').textContent = data.metrics?.apiCalls || data.metrics?.api_calls || 'N/A';
    document.getElementById('error-count').textContent = data.metrics?.errorCount || data.metrics?.error_count || 'N/A';
    document.getElementById('total-cost').textContent = data.metrics?.totalCost || data.metrics?.total_cost || 'N/A';

    // Recent Commits
    const recentCommitsList = document.getElementById('recent-commits');
    recentCommitsList.innerHTML = '';
    const commits = data.recentCommits || data.recent_commits || [];
    if (commits.length > 0) {
        commits.forEach(commit => {
            const li = document.createElement('li');
            li.textContent = `${commit.timestamp}: ${commit.message} (${commit.repo})`;
            recentCommitsList.appendChild(li);
        });
    } else {
        recentCommitsList.innerHTML = '<li>No recent commits.</li>';
    }

    // Scheduled Operations (Cron Jobs)
    const scheduledOpsList = document.getElementById('scheduled-operations');
    scheduledOpsList.innerHTML = '';
    const ops = data.scheduledOperations || data.scheduled_operations || [];
    if (ops.length > 0) {
        ops.forEach(op => {
            const li = document.createElement('li');
            li.textContent = `${op.nextRunTime || op.next_run_time}: ${op.name} (${op.type})`;
            scheduledOpsList.appendChild(li);
        });
    } else {
        scheduledOpsList.innerHTML = '<li>No scheduled operations.</li>';
    }

    // Agent Communication Log
    const commsLog = data.agentCommsLog || data.agent_comms_log || 'No recent communications.';
    document.getElementById('agent-comms-log').textContent = commsLog;

    // Skill Idea Snapshots
    const skillIdeas = data.skillIdeas || data.skill_ideas || 'No new skill ideas.';
    document.getElementById('skill-ideas-display').textContent = skillIdeas;
}

function renderKanbanColumn(ulId, tasks) {
    const ul = document.getElementById(ulId);
    ul.innerHTML = '';
    if (tasks && tasks.length > 0) {
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.textContent = task.description || task.title || 'Untitled task';
            ul.appendChild(li);
        });
    } else {
        ul.innerHTML = '<li>No tasks.</li>';
    }
}

// Function to periodically update data (will be called externally by me)
function updateMissionControlData(newData) {
    // This function will be called by me internally to update the control_data.json
    // For now, it just re-renders the dashboard with new data
    renderDashboard(newData);
    updateLastSync();
}
