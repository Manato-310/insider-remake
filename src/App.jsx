import React, { useState, useEffect, useMemo } from 'react';

// Tailwind CSSを読み込むためのscriptタグをheadに追加します
const setupTailwind = () => {
  if (!document.querySelector('script[src="https://cdn.tailwindcss.com"]')) {
    const script = document.createElement('script');
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
  }
};
setupTailwind();

// --- Main App Component ---
export default function App() {
  // Game State Management
  const [gameState, setGameState] = useState('SETUP'); // SETUP, RULES, MASTER_REVEAL, TOPIC_SETUP, ROLE_REVEAL, DISCUSSION, VOTE, RESULT
  const [settings, setSettings] = useState({
    playerCount: 4,
    gameTime: 300, // 5 minutes in seconds
    questionLimit: 15,
    masterSelectionMode: 'RANDOM', // RANDOM or MANUAL
    manualMasterId: '0',
    playerNames: Array(4).fill(''),
  });
  const [players, setPlayers] = useState([]);
  const [secretTopic, setSecretTopic] = useState('');
  const [roleRevealIndex, setRoleRevealIndex] = useState(0);
  const [isRoleVisible, setIsRoleVisible] = useState(false);

  // Discussion State
  const [timeLeft, setTimeLeft] = useState(settings.gameTime);
  const [questionsLeft, setQuestionsLeft] = useState(settings.questionLimit);
  const [discussionLog, setDiscussionLog] = useState([]);
  const [discussionEndedBy, setDiscussionEndedBy] = useState(null); // 'TIMEUP', 'SOLVED', 'QUESTIONS_UP'

  // Vote State
  const [votedPlayerId, setVotedPlayerId] = useState(null);

  // --- Utility Functions ---
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const getRoleNameInJapanese = (role) => {
    switch (role) {
      case 'Saboteur': return '犯人';
      case 'Pathfinder': return '情報屋';
      case 'SEEKER': return '容疑者';
      default: return role;
    }
  };

  const getPlayerById = (id) => players.find(p => p.id === id);

  const handlePlayerNameChange = (index, name) => {
    const newPlayerNames = [...settings.playerNames];
    newPlayerNames[index] = name;
    setSettings(prev => ({ ...prev, playerNames: newPlayerNames }));
  };

  const handlePlayerCountChange = (e) => {
    const newCount = parseInt(e.target.value);
    setSettings(prev => {
      const currentNames = prev.playerNames;
      const newNames = Array(newCount).fill('').map((_, i) => currentNames[i] || '');
      return {
        ...prev,
        playerCount: newCount,
        playerNames: newNames,
        manualMasterId: parseInt(prev.manualMasterId) >= newCount ? '0' : prev.manualMasterId,
      }
    });
  };

  // --- Game Flow Handlers ---
  const handleSetupSubmit = (e) => {
    e.preventDefault();
    const names = settings.playerNames.map((name, i) => name || `容疑者 ${i + 1}`);

    let baseRoles = ['Saboteur', 'Pathfinder'];
    for (let i = 0; i < settings.playerCount - 2; i++) {
      baseRoles.push('SEEKER');
    }
    const shuffledRoles = shuffleArray(baseRoles);

    let initialPlayers = Array.from({ length: settings.playerCount }, (_, i) => ({
      id: i,
      name: names[i],
      role: shuffledRoles[i],
      isMaster: false,
    }));

    let newMasterId;
    if (settings.masterSelectionMode === 'RANDOM') {
      newMasterId = Math.floor(Math.random() * settings.playerCount);
    } else {
      newMasterId = parseInt(settings.manualMasterId);
    }

    const masterPlayerIndex = initialPlayers.findIndex(p => p.id === newMasterId);
    if (masterPlayerIndex !== -1) {
      initialPlayers[masterPlayerIndex].isMaster = true;
    }

    setPlayers(initialPlayers);
    setTimeLeft(settings.gameTime);
    setQuestionsLeft(settings.questionLimit);
    setGameState('MASTER_REVEAL');
  };

  const handleStartRoleReveal = () => {
    setRoleRevealIndex(0);
    setIsRoleVisible(false);
    setGameState('ROLE_REVEAL');
  };

  const handleNextRoleReveal = () => {
    setIsRoleVisible(false);
    if (roleRevealIndex < players.filter(p => !p.isMaster).length - 1) {
      setRoleRevealIndex(prev => prev + 1);
    } else {
      setGameState('DISCUSSION_PREP');
    }
  };

  const handleLogQuestion = (playerId, type) => {
    if (questionsLeft > 0) {
      setDiscussionLog([...discussionLog, { playerId, type }]);
      setQuestionsLeft(prev => prev - 1);
    }
  };

  const handleEndDiscussion = (reason) => {
    setDiscussionEndedBy(reason);
    setGameState('VOTE');
  };

  const handleVoteSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const votedId = formData.get('vote');
    if (votedId !== null) {
      const selectedPlayerId = parseInt(votedId, 10);
      setVotedPlayerId(selectedPlayerId);
      setGameState('RESULT');
    }
  };

  const handleRestartGame = () => {
    setGameState('SETUP');
    setPlayers([]);
    setSecretTopic('');
    setDiscussionLog([]);
    setVotedPlayerId(null);
    setDiscussionEndedBy(null);
    setRoleRevealIndex(0);
    setIsRoleVisible(false);
  };

  useEffect(() => {
    if (gameState !== 'DISCUSSION') return;
    if (timeLeft <= 0) { handleEndDiscussion('TIMEUP'); return; }
    if (questionsLeft <= 0) { handleEndDiscussion('QUESTIONS_UP'); return; }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [gameState, timeLeft, questionsLeft]);

  const getPlayerLogCounts = (playerId) => {
    const counts = { O: 0, X: 0, '?': 0 };
    discussionLog.forEach(log => {
      if (log.playerId === playerId) {
        counts[log.type]++;
      }
    });
    return counts;
  };

  // --- Render Functions ---

  const renderRules = () => (
    <div className="p-6 font-serif h-full flex flex-col">
        <h1 className="text-3xl font-bold text-center mb-4 text-stone-800">遊び方</h1>
        <div className="flex-grow overflow-y-auto text-stone-700 space-y-4 pr-2 text-left">
            <div>
                <h2 className="text-xl font-bold text-stone-800 border-b-2 border-stone-400 pb-1 mb-2">役職</h2>
                <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-stone-900">容疑者:</strong> 事件に巻き込まれてしまった一般人。「事件解決の鍵」を突き止め、自らの疑いを晴らすのが目的。</li>
                    <li><strong className="text-stone-900">情報屋:</strong> 犯人に恨みを持つ裏社会の情報屋。「事件解決の鍵」を知っているが、正体を知られる分けにはいかない。皆を「鍵」の発見に導き、犯人への復讐を果たすのが目的。</li>
                    <li><strong className="text-red-800">犯人:</strong> 事件の犯人。犯人なので当然「事件解決の鍵」を知っている。「鍵」の特定を妨害するのが目的。仮に「鍵」が見つけられても、情報屋を特定することで罪をかぶせることができる。</li>
                    <li><strong className="text-stone-900">証人:</strong> 「事件解決の鍵」を知り、質問に「はい」「いいえ」「わからない」だけで答える。なぜ最初から「鍵」を教えないのか、その理由は彼らの立場にある。</li>
                </ul>
            </div>
            <div>
                <h2 className="text-xl font-bold text-stone-800 border-b-2 border-stone-400 pb-1 mb-2">勝利条件</h2>
                <div className="space-y-3">
                    <div className="bg-stone-200 p-3 rounded-sm border-l-4 border-green-800">
                        <h3 className="font-bold text-lg text-green-900">【「鍵」が見つかった場合】</h3>
                        <p>犯人による<strong className="text-red-800">【情報屋の特定】</strong>が始まる。</p>
                        <ul className="list-disc list-inside mt-1">
                            <li>犯人が情報屋を<strong className="text-red-800">当てた</strong> → <strong className="text-red-800">犯人の逆転勝利！</strong></li>
                            <li>犯人が情報屋を<strong className="text-green-800">外した</strong> → <strong className="text-green-800">容疑者チームの勝利！</strong></li>
                        </ul>
                    </div>
                    <div className="bg-stone-200 p-3 rounded-sm border-l-4 border-red-800">
                        <h3 className="font-bold text-lg text-red-900">【「鍵」が見つからなかった場合】</h3>
                        <p>全員で<strong className="text-green-800">【犯人の特定】</strong>が始まる。</p>
                         <ul className="list-disc list-inside mt-1">
                            <li>全員で犯人を<strong className="text-green-800">当てた</strong> → <strong className="text-green-800">容疑者チームの勝利！</strong></li>
                            <li>全員で犯人を<strong className="text-red-800">外した</strong> → <strong className="text-red-800">犯人の勝利！</strong></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <button
            onClick={() => setGameState('SETUP')}
            className="w-full mt-4 bg-stone-800 text-stone-100 font-bold py-3 px-4 rounded-sm hover:bg-stone-700 tracking-wider"
        >
            設定に戻る
        </button>
    </div>
  );

  const renderSetup = () => {
    const playerInputs = Array.from({ length: settings.playerCount }, (_, i) => (
      <input
        key={i}
        type="text"
        placeholder={`容疑者 ${i + 1}`}
        className="block w-full p-2 bg-stone-50 border border-stone-400 rounded-sm placeholder-stone-500"
        value={settings.playerNames[i]}
        onChange={e => handlePlayerNameChange(i, e.target.value)}
      />
    ));

    return (
      <div className="relative p-6 md:p-8 font-serif">
         <button
            onClick={() => setGameState('RULES')}
            className="absolute top-4 right-4 text-stone-500 hover:text-stone-900 transition-colors z-10"
            aria-label="ルールを表示"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </button>
        <h1 className="text-4xl font-bold text-center mb-2 text-stone-800">事件簿</h1>
        <p className="text-center text-stone-600 mb-8">ゲーム設定</p>
        <form onSubmit={handleSetupSubmit} className="space-y-6">
          <div>
            <label htmlFor="playerCount" className="block text-sm font-bold text-stone-700">参加人数</label>
            <select id="playerCount" value={settings.playerCount} onChange={handlePlayerCountChange} className="mt-1 block w-full pl-3 pr-10 py-2 bg-stone-50 border border-stone-400 focus:outline-none focus:ring-stone-500 focus:border-stone-500 rounded-sm">
              {[4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}人</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="gameTime" className="block text-sm font-bold text-stone-700">捜査時間(分)</label>
              <input type="number" id="gameTime" value={settings.gameTime / 60} onChange={e => setSettings({ ...settings, gameTime: parseInt(e.target.value) * 60 })} min="1" className="mt-1 block w-full p-2 bg-stone-50 border border-stone-400 rounded-sm" />
            </div>
            <div>
              <label htmlFor="questionLimit" className="block text-sm font-bold text-stone-700">質問回数</label>
              <input type="number" id="questionLimit" value={settings.questionLimit} onChange={e => setSettings({ ...settings, questionLimit: parseInt(e.target.value) })} min="1" className="mt-1 block w-full p-2 bg-stone-50 border border-stone-400 rounded-sm" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-stone-800 mb-2">容疑者リスト</h3>
            <div className="grid grid-cols-2 gap-4">{playerInputs}</div>
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700">証人の選択</label>
            <div className="mt-2 flex">
              <button type="button" onClick={() => setSettings({ ...settings, masterSelectionMode: 'RANDOM' })} className={`flex-1 px-4 py-2 text-sm font-medium ${settings.masterSelectionMode === 'RANDOM' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'} border border-stone-400 rounded-l-sm`}>ランダム</button>
              <button type="button" onClick={() => setSettings({ ...settings, masterSelectionMode: 'MANUAL' })} className={`flex-1 px-4 py-2 text-sm font-medium ${settings.masterSelectionMode === 'MANUAL' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'} border-t border-b border-r border-stone-400 rounded-r-sm`}>選択する</button>
            </div>
          </div>
          {settings.masterSelectionMode === 'MANUAL' && (
            <div>
              <label htmlFor="manualMasterId" className="block text-sm font-bold text-stone-700">証人にする人物</label>
              <select id="manualMasterId" value={settings.manualMasterId} onChange={e => setSettings({ ...settings, manualMasterId: e.target.value })} className="mt-1 block w-full pl-3 pr-10 py-2 bg-stone-50 border border-stone-400 focus:outline-none focus:ring-stone-500 focus:border-stone-500 rounded-sm">
                {settings.playerNames.map((name, i) => (
                  <option key={i} value={i}>{name || `容疑者 ${i + 1}`}</option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="w-full bg-stone-800 text-stone-100 font-bold py-3 px-4 rounded-sm hover:bg-stone-700 transition-colors duration-300 tracking-wider">捜査開始</button>
        </form>
      </div>
    );
  };

  const masterPlayer = useMemo(() => players.find(p => p.isMaster), [players]);

  const renderMasterReveal = () => (
    <div className="text-center flex flex-col justify-center items-center h-full p-8 font-serif">
      <p className="text-lg text-stone-600 mb-2">今回の証人は...</p>
      <h1 className="text-5xl font-extrabold text-stone-800 mb-8">{masterPlayer?.name}氏</h1>
      <p className="mb-8 text-stone-700">証人は資料を受け取り、「事件解決の鍵」を確認してください。</p>
      <button onClick={() => setGameState('TOPIC_SETUP')} className="w-full max-w-sm bg-stone-800 text-stone-100 font-bold py-3 px-4 rounded-sm hover:bg-stone-700 tracking-wider">資料を確認</button>
    </div>
  );

  const renderTopicSetup = () => (
    <div className="text-center p-8 font-serif">
      <h1 className="text-2xl font-bold mb-4 text-stone-800">{masterPlayer?.name}氏、「事件解決の鍵」を記入</h1>
      <textarea value={secretTopic} onChange={e => setSecretTopic(e.target.value)} placeholder="例：万年筆" className="w-full p-3 mb-6 bg-stone-50 border-2 border-stone-400 rounded-sm text-center text-xl font-mono focus:ring-stone-500 focus:border-stone-500" rows="2"></textarea>
      <button disabled={!secretTopic} onClick={() => setGameState('MASTER_ROLE_REVEAL')} className="w-full max-w-sm bg-green-800 text-white font-bold py-3 px-4 rounded-sm hover:bg-green-700 disabled:bg-stone-400 tracking-wider">鍵を決定</button>
    </div>
  );

  const renderMasterRoleReveal = () => (
    <div className="text-center flex flex-col justify-center items-center h-full p-8 font-serif">
      <p className="text-lg text-stone-600 mb-2">{masterPlayer?.name}氏の役職は...</p>
      <h1 className="text-5xl font-extrabold text-red-800 mb-8">{getRoleNameInJapanese(masterPlayer?.role)}</h1>
      <p className="mb-8 text-stone-700">確認後、次の容疑者に資料を回してください。</p>
      <button onClick={handleStartRoleReveal} className="w-full max-w-sm bg-stone-800 text-stone-100 font-bold py-3 px-4 rounded-sm hover:bg-stone-700 tracking-wider">次へ</button>
    </div>
  );

  const nonMasterPlayers = useMemo(() => players.filter(p => !p.isMaster), [players]);
  const currentPlayerForReveal = nonMasterPlayers[roleRevealIndex];

  const renderRoleReveal = () => (
    <div className="text-center flex flex-col justify-center items-center h-full p-8 font-serif">
      {!isRoleVisible ? (
        <>
          <p className="text-xl text-stone-600 mb-4">次の容疑者は</p>
          <h1 className="text-5xl font-extrabold text-stone-800 mb-8">{currentPlayerForReveal?.name}氏</h1>
          <p className="mb-8 text-stone-700">資料を受け取り、ボタンを押して役職を確認してください。</p>
          <button onClick={() => setIsRoleVisible(true)} className="w-full max-w-sm bg-green-800 text-white font-bold py-3 px-4 rounded-sm hover:bg-green-700 tracking-wider">役職を確認</button>
        </>
      ) : (
        <>
          <p className="text-xl text-stone-600 mb-2">{currentPlayerForReveal?.name}氏の役職は...</p>
          <h1 className="text-5xl font-extrabold text-red-800 mb-8">{getRoleNameInJapanese(currentPlayerForReveal?.role)}</h1>
          
          {['Saboteur', 'Pathfinder'].includes(currentPlayerForReveal?.role) ? (
            <p className="my-4 text-stone-700">事件解決の鍵は「<span className="font-bold font-mono text-stone-900">{secretTopic}</span>」だ。</p>
          ) : (
            <div className="w-full max-w-sm p-2 border-2 border-red-800 my-4">
              <p className="text-red-800 font-bold text-lg">TOP SECRET</p>
            </div>
          )}

          <p className="mb-8 text-stone-700">確認後、次の容疑者に資料を回してください。</p>
          <button onClick={handleNextRoleReveal} className="w-full max-w-sm bg-stone-800 text-stone-100 font-bold py-3 px-4 rounded-sm hover:bg-stone-700 tracking-wider">確認した</button>
        </>
      )}
    </div>
  );

  const renderDiscussionPrep = () => (
    <div className="text-center flex flex-col justify-center items-center h-full p-8 font-serif">
      <h1 className="text-3xl font-bold text-stone-800 mb-6">全員の役職確認が完了</h1>
      <p className="mb-8 text-stone-700">証人に資料を戻し、聞き込みを開始してください。</p>
      <button onClick={() => setGameState('DISCUSSION')} className="w-full max-w-sm bg-green-800 text-white font-bold py-4 px-6 rounded-sm text-xl hover:bg-green-700 tracking-wider">聞き込み開始</button>
    </div>
  );

  const renderDiscussion = () => (
    <div className="p-4 md:p-6 h-full flex flex-col font-serif">
      <div className="flex justify-between items-center mb-4 p-4 bg-stone-200 border-b-4 border-stone-300 rounded-sm">
        <div className="text-center">
          <p className="text-sm text-stone-600">残り時間</p>
          <p className="text-2xl font-bold text-stone-800">{Math.floor(timeLeft / 60)}:{('0' + timeLeft % 60).slice(-2)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-stone-600">残り質問数</p>
          <p className="text-2xl font-bold text-red-800">{questionsLeft}</p>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-3">
        {players.map(player => {
          const counts = getPlayerLogCounts(player.id);
          return (
            <div key={player.id} className="p-3 bg-stone-50 rounded-sm border border-stone-300 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-800">{player.name} {player.isMaster && ' (証人)'}</span>
                {!player.isMaster && (
                  <div className="flex space-x-4">
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleLogQuestion(player.id, 'O')} className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-stone-500 bg-white text-stone-700 font-bold text-xl hover:bg-stone-100 transition">O</button>
                      <span className="text-sm font-semibold text-stone-600 mt-1">{counts.O}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleLogQuestion(player.id, 'X')} className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-stone-500 bg-white text-stone-700 font-bold text-xl hover:bg-stone-100 transition">X</button>
                      <span className="text-sm font-semibold text-stone-600 mt-1">{counts.X}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleLogQuestion(player.id, '?')} className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-stone-500 bg-white text-stone-700 font-bold text-xl hover:bg-stone-100 transition">?</button>
                      <span className="text-sm font-semibold text-stone-600 mt-1">{counts['?']}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4">
        <button onClick={() => handleEndDiscussion('SOLVED')} className="w-full bg-green-800 text-white font-bold py-3 px-4 rounded-sm hover:bg-green-700 tracking-wider">鍵がわかった！</button>
      </div>
    </div>
  );

  const renderVote = () => {
    const wasWordGuessed = discussionEndedBy === 'SOLVED';
    const voteTitle = wasWordGuessed ? "情報屋を特定してください" : "犯人を特定してください";
    
    let playersToVote;
    if (wasWordGuessed) {
      const saboteur = players.find(p => p.role === 'Saboteur');
      playersToVote = saboteur ? players.filter(p => p.id !== saboteur.id) : players;
    } else {
      playersToVote = players;
    }

    return (
      <div className="p-6 md:p-8 font-serif">
        <h1 className="text-2xl font-bold text-center mb-4">{voteTitle}</h1>
        <form onSubmit={handleVoteSubmit} className="space-y-3">
          {playersToVote.map(player => {
            const counts = getPlayerLogCounts(player.id);
            return (
              <label key={player.id} className="block p-4 bg-stone-50 rounded-sm border border-stone-300 cursor-pointer has-[:checked]:bg-stone-200 has-[:checked]:ring-2 has-[:checked]:ring-stone-600 transition-all">
                <div className="flex items-center">
                  <input type="radio" name="vote" value={player.id} className="h-5 w-5 text-stone-600 focus:ring-stone-500" required />
                  <span className="ml-4 text-lg font-medium text-stone-800">{player.name} {player.isMaster && '(証人)'}</span>
                  <div className="ml-auto flex space-x-3 text-sm font-mono">
                    <span className="font-bold text-green-700">O:{counts.O}</span>
                    <span className="font-bold text-red-700">X:{counts.X}</span>
                    <span className="font-bold text-yellow-700">?:{counts['?']}</span>
                  </div>
                </div>
              </label>
            )
          })}
          <button type="submit" className="w-full !mt-6 bg-red-800 text-white font-bold py-3 px-4 rounded-sm hover:bg-red-700 tracking-wider">投票を決定</button>
        </form>
      </div>
    );
  };

  const renderResult = () => {
    if (votedPlayerId === null) return <div className="p-8 text-center text-stone-700">結果を計算中...</div>;

    const votedPlayer = getPlayerById(votedPlayerId);
    const wasWordGuessed = discussionEndedBy === 'SOLVED';
    
    let winnerText, winnerMessage, winnerColorClass;

    if(wasWordGuessed) {
        if(votedPlayer.role === 'Pathfinder') {
            winnerText = '犯人の勝利！';
            winnerMessage = '犯人は、情報屋に罪を被せることに成功した！';
            winnerColorClass = 'text-red-800';
        } else {
            winnerText = '容疑者チームの勝利！';
            winnerMessage = '情報屋は正体を隠し通し、事件は解決へと向かった！';
            winnerColorClass = 'text-green-800';
        }
    } else {
        if(votedPlayer.role === 'Saboteur') {
            winnerText = '容疑者チームの勝利！';
            winnerMessage = '「事件解決の鍵」は見つからなかったが、不審な行動から犯人を特定した！';
            winnerColorClass = 'text-green-800';
        } else {
            winnerText = '犯人の勝利！';
            winnerMessage = '犯人は最後まで逃げ切り、事件は迷宮入りとなった…。';
            winnerColorClass = 'text-red-800';
        }
    }

    return (
      <div className="text-center flex flex-col justify-start items-center h-full p-6 overflow-y-auto font-serif">
        <h1 className={`text-4xl font-extrabold mb-2 ${winnerColorClass}`}>{winnerText}</h1>
        <p className="text-stone-700 mb-6">{winnerMessage}</p>
        <div className="w-full bg-stone-200 p-4 rounded-sm shadow-md mb-6 border border-stone-300">
          <p className="text-sm text-stone-600">事件解決の鍵</p>
          <p className="text-2xl font-bold text-stone-800 font-mono">{secretTopic}</p>
        </div>
        <div className="w-full text-left">
          <h2 className="text-xl font-bold text-stone-800 mb-3">最終報告書</h2>
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className={`p-3 rounded-sm flex justify-between items-center ${p.id === votedPlayerId ? 'bg-yellow-200 ring-2 ring-yellow-500' : 'bg-stone-200 border border-stone-300'}`}>
                <div>
                  <p className="font-bold text-stone-900">{p.name} {p.isMaster && '(証人)'}</p>
                  <p className="text-sm text-stone-600">{getRoleNameInJapanese(p.role)}</p>
                </div>
                {p.id === votedPlayerId && (
                  <span className="text-sm font-bold text-yellow-800 bg-yellow-300 px-2 py-1 rounded-sm">投票先</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <button onClick={handleRestartGame} className="w-full max-w-sm mt-8 bg-stone-800 text-stone-100 font-bold py-3 px-4 rounded-sm hover:bg-stone-700 tracking-wider">新たな事件へ</button>
      </div>
    );
  };

  // --- Main Render Switch ---
  const renderContent = () => {
    switch (gameState) {
      case 'SETUP': return renderSetup();
      case 'RULES': return renderRules();
      case 'MASTER_REVEAL': return renderMasterReveal();
      case 'TOPIC_SETUP': return renderTopicSetup();
      case 'MASTER_ROLE_REVEAL': return renderMasterRoleReveal();
      case 'ROLE_REVEAL': return renderRoleReveal();
      case 'DISCUSSION_PREP': return renderDiscussionPrep();
      case 'DISCUSSION': return renderDiscussion();
      case 'VOTE': return renderVote();
      case 'RESULT': return renderResult();
      default: return <div>エラーが発生しました。</div>;
    }
  };

  return (
    <div className="bg-[#fdf6e3] text-stone-800 min-h-screen flex items-center justify-center p-2 sm:p-4">
      <main className="w-full max-w-md mx-auto bg-[#fbf1c7] border-4 border-stone-300 rounded-sm shadow-2xl overflow-hidden relative" style={{ height: '90vh', maxHeight: '900px' }}>
        <div className="h-full overflow-y-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}