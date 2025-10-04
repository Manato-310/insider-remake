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
  const [gameState, setGameState] = useState('SETUP'); // SETUP, MASTER_REVEAL, TOPIC_SETUP, ROLE_REVEAL, DISCUSSION, VOTE, RESULT
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
      case 'Saboteur': return '妨害者';
      case 'Pathfinder': return 'インサイダー';
      case 'SEEKER': return '市民';
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
    const names = settings.playerNames.map((name, i) => name || `プレイヤー ${i + 1}`);

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
    if(masterPlayerIndex !== -1) {
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


  // --- Timer & Question Limit Effect ---
  useEffect(() => {
    if (gameState !== 'DISCUSSION') return;

    if (timeLeft <= 0) {
      handleEndDiscussion('TIMEUP');
      return;
    }
    if (questionsLeft <= 0) {
      handleEndDiscussion('QUESTIONS_UP');
      return;
    }

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


  // --- Render Functions for Each Game State ---

  const renderSetup = () => {
    const playerInputs = Array.from({ length: settings.playerCount }, (_, i) => (
      <input 
        key={i} 
        name={`player${i}`} 
        type="text" 
        placeholder={`プレイヤー ${i + 1}`} 
        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm"
        value={settings.playerNames[i]}
        onChange={e => handlePlayerNameChange(i, e.target.value)}
      />
    ));
    
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">インサイダーゲーム</h1>
        <p className="text-center text-gray-500 mb-6">ゲームの設定を入力してください</p>
        <form onSubmit={handleSetupSubmit} className="space-y-6">
          <div>
            <label htmlFor="playerCount" className="block text-sm font-medium text-gray-700">参加人数</label>
            <select id="playerCount" value={settings.playerCount} onChange={handlePlayerCountChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
              {[4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}人</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="gameTime" className="block text-sm font-medium text-gray-700">解答時間 (分)</label>
              <input type="number" id="gameTime" value={settings.gameTime / 60} onChange={e => setSettings({...settings, gameTime: parseInt(e.target.value) * 60})} min="1" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
            </div>
            <div>
              <label htmlFor="questionLimit" className="block text-sm font-medium text-gray-700">質問回数</label>
              <input type="number" id="questionLimit" value={settings.questionLimit} onChange={e => setSettings({...settings, questionLimit: parseInt(e.target.value)})} min="1" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">参加者の名前</h3>
            <div className="grid grid-cols-2 gap-4">{playerInputs}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ゲームマスターの選択</label>
            <div className="mt-2 flex rounded-md shadow-sm">
              <button type="button" onClick={() => setSettings({...settings, masterSelectionMode: 'RANDOM'})} className={`flex-1 px-4 py-2 text-sm font-medium ${settings.masterSelectionMode === 'RANDOM' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} border border-gray-300 rounded-l-md`}>ランダム</button>
              <button type="button" onClick={() => setSettings({...settings, masterSelectionMode: 'MANUAL'})} className={`flex-1 px-4 py-2 text-sm font-medium ${settings.masterSelectionMode === 'MANUAL' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} border-t border-b border-r border-gray-300 rounded-r-md`}>選択する</button>
            </div>
          </div>
          {settings.masterSelectionMode === 'MANUAL' && (
            <div>
              <label htmlFor="manualMasterId" className="block text-sm font-medium text-gray-700">ゲームマスターにする人</label>
              <select id="manualMasterId" value={settings.manualMasterId} onChange={e => setSettings({...settings, manualMasterId: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                {settings.playerNames.map((name, i) => (
                  <option key={i} value={i}>{name || `プレイヤー ${i + 1}`}</option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 shadow-lg transform hover:scale-105">ゲームスタート</button>
        </form>
      </div>
    );
  };
  
  const masterPlayer = useMemo(() => players.find(p => p.isMaster), [players]);

  const renderMasterReveal = () => (
    <div className="text-center flex flex-col justify-center items-center h-full p-8">
        <p className="text-lg text-gray-600 mb-2">今回のゲームマスターは...</p>
        <h1 className="text-5xl font-extrabold text-indigo-600 mb-8 animate-pulse">{masterPlayer?.name}さんです！</h1>
        <p className="mb-8 text-gray-700">ゲームマスターはスマホを受け取り、お題を決めてください。</p>
        <button onClick={() => setGameState('TOPIC_SETUP')} className="w-full max-w-sm bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 shadow-lg transform hover:scale-105">お題入力へ</button>
    </div>
  );

  const renderTopicSetup = () => (
    <div className="text-center p-8">
        <h1 className="text-2xl font-bold mb-4">{masterPlayer?.name}さん、お題を入力してください</h1>
        <input type="text" value={secretTopic} onChange={e => setSecretTopic(e.target.value)} placeholder="例：りんご" className="w-full p-3 mb-6 border-2 border-gray-300 rounded-lg text-center text-xl focus:ring-indigo-500 focus:border-indigo-500"/>
        <button disabled={!secretTopic} onClick={() => setGameState('MASTER_ROLE_REVEAL')} className="w-full max-w-sm bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors duration-300 shadow-lg transform hover:scale-105">お題を決定</button>
    </div>
  );

  const renderMasterRoleReveal = () => (
    <div className="text-center flex flex-col justify-center items-center h-full p-8">
        <p className="text-lg text-gray-600 mb-2">{masterPlayer?.name}さんの役職は...</p>
        <h1 className="text-5xl font-extrabold text-red-500 mb-8">{getRoleNameInJapanese(masterPlayer?.role)}</h1>
        <p className="mb-8 text-gray-700">確認したら「次へ」を押し、他のプレイヤーにスマホを回してください。</p>
        <button onClick={handleStartRoleReveal} className="w-full max-w-sm bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 shadow-lg transform hover:scale-105">次へ</button>
    </div>
  );
  
  const nonMasterPlayers = useMemo(() => players.filter(p => !p.isMaster), [players]);
  const currentPlayerForReveal = nonMasterPlayers[roleRevealIndex];

  const renderRoleReveal = () => (
      <div className="text-center flex flex-col justify-center items-center h-full p-8">
          {!isRoleVisible ? (
              <>
                  <p className="text-xl text-gray-600 mb-4">次は</p>
                  <h1 className="text-5xl font-extrabold text-indigo-600 mb-8">{currentPlayerForReveal?.name}さん</h1>
                  <p className="mb-8 text-gray-700">スマホを受け取ったら、下のボタンを押して役職を確認してください。</p>
                  <button onClick={() => setIsRoleVisible(true)} className="w-full max-w-sm bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition-colors duration-300 shadow-lg transform hover:scale-105">役職を確認する</button>
              </>
          ) : (
              <>
                  <p className="text-xl text-gray-600 mb-2">{currentPlayerForReveal?.name}さんの役職は...</p>
                  <h1 className="text-5xl font-extrabold text-red-500 mb-8">{getRoleNameInJapanese(currentPlayerForReveal?.role)}</h1>
                  {['Saboteur', 'Pathfinder'].includes(currentPlayerForReveal?.role) && (
                    <p className="mb-2 text-gray-700">お題は「<span className="font-bold">{secretTopic}</span>」です。</p>
                  )}
                  <p className="mb-8 text-gray-700">確認したら次の人にスマホを回してください。</p>
                  <button onClick={handleNextRoleReveal} className="w-full max-w-sm bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 shadow-lg transform hover:scale-105">確認しました</button>
              </>
          )}
      </div>
  );

  const renderDiscussionPrep = () => (
      <div className="text-center flex flex-col justify-center items-center h-full p-8">
          <h1 className="text-3xl font-bold mb-6">全員の役職確認が終わりました</h1>
          <p className="mb-8 text-gray-700">ゲームマスターにスマホを返し、会議を開始してください。</p>
          <button onClick={() => setGameState('DISCUSSION')} className="w-full max-w-sm bg-green-500 text-white font-bold py-4 px-6 rounded-lg text-xl hover:bg-green-600 transition-colors duration-300 shadow-lg transform hover:scale-105">会議フェイズ スタート</button>
      </div>
  );

  const renderDiscussion = () => (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 p-4 bg-gray-100 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-gray-500">残り時間</p>
          <p className="text-2xl font-bold text-indigo-600">{Math.floor(timeLeft / 60)}:{('0' + timeLeft % 60).slice(-2)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">残り質問回数</p>
          <p className="text-2xl font-bold text-red-500">{questionsLeft} / {settings.questionLimit}</p>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-3">
        {players.map(player => {
            const counts = getPlayerLogCounts(player.id);
            return (
              <div key={player.id} className="p-3 bg-white rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800">{player.name} {player.isMaster && ' (ゲームマスター)'}</span>
                  {!player.isMaster && (
                      <div className="flex space-x-4">
                        <div className="flex flex-col items-center">
                          <button onClick={() => handleLogQuestion(player.id, 'O')} className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-green-500 text-green-500 font-bold text-xl hover:bg-green-100 transition">O</button>
                          <span className="text-sm font-semibold text-gray-700 mt-1">{counts.O}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <button onClick={() => handleLogQuestion(player.id, 'X')} className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-red-500 text-red-500 font-bold text-xl hover:bg-red-100 transition">X</button>
                           <span className="text-sm font-semibold text-gray-700 mt-1">{counts.X}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <button onClick={() => handleLogQuestion(player.id, '?')} className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-yellow-500 text-yellow-500 font-bold text-xl hover:bg-yellow-100 transition">?</button>
                          <span className="text-sm font-semibold text-gray-700 mt-1">{counts['?']}</span>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )
        })}
      </div>
      <div className="mt-4">
        <button onClick={() => handleEndDiscussion('SOLVED')} className="w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition-colors duration-300 shadow-lg">お題がわかった！</button>
      </div>
    </div>
  );
  
  const renderVote = () => {
    const wasWordGuessed = discussionEndedBy === 'SOLVED';

    let voteTitle;
    let playersToVote;

    if (wasWordGuessed) {
        voteTitle = "インサイダーを選択してください";
        const saboteur = players.find(p => p.role === 'Saboteur');
        playersToVote = saboteur ? players.filter(p => p.id !== saboteur.id) : players;
    } else {
        voteTitle = "妨害者を選択してください";
        playersToVote = players;
    }
      
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold text-center mb-4">{voteTitle}</h1>
        <form onSubmit={handleVoteSubmit} className="space-y-3">
          {playersToVote.map(player => {
            const counts = getPlayerLogCounts(player.id);
            return (
              <label key={player.id} className="block p-4 bg-white rounded-lg shadow cursor-pointer has-[:checked]:bg-indigo-100 has-[:checked]:ring-2 has-[:checked]:ring-indigo-500 transition-all">
                <div className="flex items-center">
                  <input type="radio" name="vote" value={player.id} className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 required:border-red-500" required/>
                  <span className="ml-4 text-lg font-medium text-gray-800">{player.name} {player.isMaster && '(ゲームマスター)'}</span>
                  <div className="ml-auto flex space-x-3 text-sm">
                    <span className="font-bold text-green-600">O: {counts.O}</span>
                    <span className="font-bold text-red-600">X: {counts.X}</span>
                    <span className="font-bold text-yellow-600">?: {counts['?']}</span>
                  </div>
                </div>
              </label>
            )
          })}
          <button type="submit" className="w-full mt-6 bg-red-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-600 transition-colors duration-300 shadow-lg">投票を決定</button>
        </form>
      </div>
    );
  };
  
  {/* --- UPDATED: Result logic with special Saboteur win condition --- */}
  const renderResult = () => {
    if (votedPlayerId === null) return <div className="p-8 text-center">結果を計算中...</div>;

    const votedPlayer = getPlayerById(votedPlayerId);
    const wasWordGuessed = discussionEndedBy === 'SOLVED';
    const voteTargetRole = wasWordGuessed ? 'Pathfinder' : 'Saboteur';

    let winnerText, winnerMessage, winnerColorClass;

    // Special win condition for Saboteur
    if (wasWordGuessed && votedPlayer.role === 'Pathfinder') {
        winnerText = `${getRoleNameInJapanese('Saboteur')}の勝利！`;
        winnerMessage = '市民に紛れてインサイダーを的確に指摘しました！';
        winnerColorClass = 'text-red-500';
    } 
    // Win condition for Citizen team (only when the word was NOT guessed)
    else if (!wasWordGuessed && votedPlayer.role === 'Saboteur') {
        winnerText = '市民チームの勝利！';
        winnerMessage = 'ゲームを妨害した妨害者を見つけ出しました！';
        winnerColorClass = 'text-green-500';
    }
    // All other cases are losses for the citizens
    else {
      const winningRole = getRoleNameInJapanese(voteTargetRole);
      winnerText = `${winningRole}の勝利！`;
      winnerMessage = wasWordGuessed
        ? 'インサイダーは正体を隠し通しました！' // Citizens failed to find the insider
        : '妨害者は最後まで逃げ切りました！'; // Citizens failed to find the saboteur
      winnerColorClass = 'text-red-500';
    }
    
    return (
      <div className="text-center flex flex-col justify-start items-center h-full p-6 bg-gray-50 overflow-y-auto">
          <h1 className={`text-4xl font-extrabold mb-2 ${winnerColorClass}`}>{winnerText}</h1>
          <p className="text-gray-600 mb-6">{winnerMessage}</p>

        <div className="w-full bg-white p-4 rounded-lg shadow-md mb-6">
            <p className="text-sm text-gray-500">お題</p>
            <p className="text-2xl font-bold text-indigo-600">{secretTopic}</p>
        </div>

        <div className="w-full text-left">
            <h2 className="text-xl font-bold text-gray-800 mb-3">結果の内訳</h2>
            <div className="space-y-2">
                {players.map(p => (
                    <div key={p.id} className={`p-3 rounded-lg flex justify-between items-center ${p.id === votedPlayerId ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-gray-100'}`}>
                        <div>
                            <p className="font-bold text-gray-900">{p.name} {p.isMaster && '(ゲームマスター)'}</p>
                            <p className="text-sm text-gray-600">{getRoleNameInJapanese(p.role)}</p>
                        </div>
                        {p.id === votedPlayerId && (
                           <span className="text-sm font-bold text-yellow-600 bg-yellow-200 px-2 py-1 rounded">投票先</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
          
          <button onClick={handleRestartGame} className="w-full max-w-sm mt-8 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 shadow-lg transform hover:scale-105">新しいゲームを始める</button>
      </div>
    );
  };

  // --- Main Render Switch ---
  const renderContent = () => {
    switch (gameState) {
      case 'SETUP': return renderSetup();
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
    <div className="bg-gray-100 min-h-screen font-sans flex items-center justify-center">
        <main className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden relative" style={{ height: '85vh', maxHeight: '900px' }}>
           <div className="h-full overflow-y-auto">
             {renderContent()}
           </div>
        </main>
    </div>
  );
}