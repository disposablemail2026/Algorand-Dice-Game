import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { NetworkId, WalletId, WalletManager, WalletProvider, useWallet } from '@txnlab/use-wallet-react';

// Configure Lute with site metadata so its popup can negotiate connection
const walletManager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
    {
      id: WalletId.LUTE,
      options: {
        siteName: 'Algo Dice Roll'
      }
    },
    WalletId.MNEMONIC
  ],
  network: NetworkId.TESTNET
});

function DiceGame() {
  const { wallets, activeAddress, activeWallet } = useWallet();
  const [diceEmoji, setDiceEmoji] = useState('🎲');
  const [status, setStatus] = useState(activeAddress ? 'Ready to roll!' : 'Select a wallet below.');
  const [isRolling, setIsRolling] = useState(false);

  const handleConnect = async (wallet) => {
    try {
      setStatus(`Connecting to ${wallet.metadata.name}...`);
      await wallet.connect();
      setStatus(`Connected! Ready to roll.`);
    } catch (err) {
      console.error(err);
      setStatus(`Connection failed: If using Lute, ensure pop-ups are allowed and you are logged in at lute.app.`);
    }
  };

  const handleDisconnect = async () => {
    if (activeWallet) {
      await activeWallet.disconnect();
      setStatus('Wallet disconnected.');
    }
  };

  const playGame = () => {
    if (!activeAddress) return;

    setIsRolling(true);
    setStatus('Rolling the dice...');

    setTimeout(() => {
      const rollResult = Math.floor(Math.random() * 6) + 1;
      const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      
      setDiceEmoji(diceEmojis[rollResult - 1]);

      if (rollResult >= 4) {
        setStatus(`🎉 You rolled a ${rollResult}! YOU WIN!`);
      } else {
        setStatus(`❌ You rolled a ${rollResult}. Try again!`);
      }
      setIsRolling(false);
    }, 600);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#121212',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      padding: '1rem'
    }}>
      <div style={{
        background: '#1e1e1e',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h1 style={{ margin: '0 0 10px 0' }}>🎲 Algo Dice Roll</h1>
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Predict if the roll will be <strong>4, 5, or 6</strong> to win!</p>

        {/* Wallet Connection Buttons */}
        {!activeAddress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
            {wallets.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet)}
                style={{
                  background: wallet.id === 'lute' ? '#ffd700' : wallet.id === 'mnemonic' ? '#00ffaa' : '#00d2ff',
                  border: 'none',
                  color: '#000',
                  padding: '12px',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Connect {wallet.metadata.name}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: '15px' }}>
            <p style={{ fontSize: '0.8rem', color: '#00d2ff', wordBreak: 'break-all', margin: '5px 0' }}>
              Connected: {activeAddress.substring(0, 6)}...{activeAddress.substring(activeAddress.length - 4)}
            </p>
            <button
              onClick={handleDisconnect}
              style={{
                background: '#333',
                color: '#ff5555',
                border: '1px solid #444',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Disconnect Wallet
            </button>
          </div>
        )}

        {/* Dice Display */}
        <div style={{ fontSize: '80px', margin: '20px 0' }}>
          {diceEmoji}
        </div>

        {/* Play Button */}
        <button
          onClick={playGame}
          disabled={!activeAddress || isRolling}
          style={{
            background: activeAddress && !isRolling ? '#00d2ff' : '#444',
            color: activeAddress && !isRolling ? '#000' : '#888',
            border: 'none',
            padding: '12px 24px',
            fontWeight: 'bold',
            borderRadius: '6px',
            cursor: activeAddress && !isRolling ? 'pointer' : 'not-allowed',
            width: '100%'
          }}
        >
          {isRolling ? 'Rolling...' : 'Bet 1 ALGO & Roll'}
        </button>

        {/* Status Message */}
        <p style={{ marginTop: '15px', fontSize: '0.85rem', color: '#aaa', wordBreak: 'break-word' }}>
          {status}
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WalletProvider manager={walletManager}>
      <DiceGame />
    </WalletProvider>
  </React.StrictMode>
);
