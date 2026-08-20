const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, process.env.NODE_ENV === 'test' ? 'team.test.json' : 'team.json');

const DEFAULT_SEED_TEAM = [
  {
    id: '1',
    username: 'anthony',
    name: 'Anthony Rahayel',
    role: 'Admin',
    joinedDate: 'Jan 2024',
    avatar: 'https://picsum.photos/seed/anthony/100/100',
    bio: 'Editor-in-Chief at 961, passionate about Lebanese culture and food.',
    socialLink: 'https://961.com/anthony'
  },
  {
    id: '2',
    username: 'sarah_k',
    name: 'Sarah Khoury',
    role: 'Editor',
    joinedDate: 'Feb 2024',
    avatar: 'https://picsum.photos/seed/sarah/100/100',
    bio: 'Senior Editor focusing on lifestyle and travel.',
    socialLink: 'https://961.com/sarah_k'
  },
  {
    id: '3',
    username: 'jdoe',
    name: 'John Doe',
    role: 'Contributor',
    joinedDate: 'Mar 2024',
    avatar: 'https://picsum.photos/seed/john/100/100',
    bio: 'Freelance writer and photographer.',
    socialLink: 'https://961.com/jdoe'
  }
];

let writeQueue = Promise.resolve();
let queue = Promise.resolve();

function enqueue(fn) {
  const res = queue.then(() => fn());
  queue = res.catch(() => {});
  return res;
}

async function ensureInitialized() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory creation failed or already exists
  }

  try {
    await fs.access(FILE_PATH);
  } catch (err) {
    const initialData = process.env.NODE_ENV === 'test' ? [] : DEFAULT_SEED_TEAM;
    await fs.writeFile(FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

async function getAllTeam() {
  await ensureInitialized();
  try {
    const data = await fs.readFile(FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function saveAll(team) {
  await ensureInitialized();
  writeQueue = writeQueue.then(async () => {
    const tempPath = `${FILE_PATH}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    await fs.writeFile(tempPath, JSON.stringify(team, null, 2), 'utf8');
    await fs.rename(tempPath, FILE_PATH);
  }).catch(err => {
    console.error('Failed to save team store:', err);
  });
  return writeQueue;
}

async function getTeamMemberById(id) {
  if (!id) return null;
  const team = await getAllTeam();
  return team.find(m => String(m.id).toLowerCase() === String(id).toLowerCase() || (m.username && m.username.toLowerCase() === String(id).toLowerCase())) || null;
}

async function createTeamMember(memberData) {
  return enqueue(async () => {
    const team = await getAllTeam();
    const id = memberData.id || crypto.randomUUID();

    const username = memberData.username ? memberData.username.toLowerCase().replace(/\s+/g, '_') : 'user_' + Math.random().toString(36).substr(2, 6);
    const name = memberData.name || memberData.username || 'Team Member';
    const joinedDate = memberData.joinedDate || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const newMember = {
      id: String(id),
      username,
      name,
      role: memberData.role || 'Contributor',
      joinedDate,
      avatar: memberData.avatar || `https://picsum.photos/seed/${username}/100/100`,
      bio: memberData.bio || '',
      socialLink: memberData.socialLink || ''
    };

    team.push(newMember);
    await saveAll(team);
    return newMember;
  });
}

async function updateTeamMember(id, updateData) {
  return enqueue(async () => {
    const team = await getAllTeam();
    const targetId = String(id).toLowerCase();
    const index = team.findIndex(m => String(m.id).toLowerCase() === targetId || (m.username && m.username.toLowerCase() === targetId));

    if (index === -1) {
      return null;
    }

    const existing = team[index];
    const updated = {
      ...existing,
      username: typeof updateData.username === 'string' ? updateData.username.toLowerCase().replace(/\s+/g, '_') : existing.username,
      name: typeof updateData.name === 'string' ? updateData.name : existing.name,
      role: typeof updateData.role === 'string' ? updateData.role : existing.role,
      joinedDate: typeof updateData.joinedDate === 'string' ? updateData.joinedDate : existing.joinedDate,
      avatar: typeof updateData.avatar === 'string' ? updateData.avatar : existing.avatar,
      bio: typeof updateData.bio === 'string' ? updateData.bio : existing.bio,
      socialLink: typeof updateData.socialLink === 'string' ? updateData.socialLink : existing.socialLink
    };

    team[index] = updated;
    await saveAll(team);
    return updated;
  });
}

async function deleteTeamMember(id) {
  return enqueue(async () => {
    const team = await getAllTeam();
    const targetId = String(id).toLowerCase();
    const index = team.findIndex(m => String(m.id).toLowerCase() === targetId || (m.username && m.username.toLowerCase() === targetId));

    if (index === -1) {
      return false;
    }

    team.splice(index, 1);
    await saveAll(team);
    return true;
  });
}

async function clearStore(useSeed = false) {
  return enqueue(async () => {
    if (useSeed) {
      await saveAll(DEFAULT_SEED_TEAM);
    } else {
      await saveAll([]);
    }
  });
}

module.exports = {
  ensureInitialized,
  getAllTeam,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  clearStore
};
