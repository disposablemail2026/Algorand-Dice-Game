import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import algosdk from 'algosdk';
import { NetworkId, WalletId, WalletManager, WalletProvider, useWallet } from '@txnlab/use-wallet-react';

const walletManager = new WalletManager({
  wallets: [
    {
      id: WalletId.PERA,
      options: {
        compactMode: false
      }
    },
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

// TestNet AlgoClient
const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
// House/Dealer address receiving bets (TestNet faucet address or any valid ALGO address)
const HOUSE_ADDRESS = 'HZ57J3TX55GWMAC27NVRRNYSPWA43V2M6GUZMBOXP23A5OMFY23U2TRP2X';

function DiceGame() {
  const { wallets, activeAddress, activeWallet, transactionSigner } = useWallet();
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
      setStatus(`Connection failed: Make sure pop-ups are allowed or open this page inside Pera's in-app browser.`);
    }
  };

  const handleDisconnect = async () => {
    if (activeWallet) {
      await activeWallet.disconnect();
      setStatus('Wallet disconnected.');
    }
  };

// On-Chain Bet & Roll Logic
  const playGame = async () => {
    if (!activeAddress) {
      setStatus('Please connect a wallet first.');
      return;
    }

    setIsRolling(true);
    setStatus('Preparing 1 ALGO bet...');

    try {
      // 1. Fetch suggested params from Algorand TestNet
      const params = await algodClient.getTransactionParams().do();

      // 2. Build 1 ALGO Payment Txn (1,000,000 microAlgos)
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        to: HOUSE_ADDRESS,
        amount: 1000000,
        suggestedParams: params
      });

      setStatus('Please approve the transaction in your wallet...');

      // 3. Encode transaction for use-wallet signer
      const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
      
      // 4. Sign using useWallet's transactionSigner hook helper
      const signedTxns = await transactionSigner([encodedTxn], [0]);

      setStatus('Submitting transaction to TestNet...');

      // 5. Send raw signed transaction to network
      const { txId } = await algodClient.sendRawTransaction(signedTxns).do();
      await algosdk.waitForConfirmation(algodClient, txId, 4);

      // 6. Roll Dice after transaction is confirmed on-chain
      setStatus('Bet Confirmed! Rolling...');
      
      setTimeout(() => {
        const rollResult = Math.floor(Math.random() * 6) + 1;
        const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        
        setDiceEmoji(diceEmojis[rollResult - 1]);

        if (rollResult >= 4) {
          setStatus(`🎉 You rolled a ${rollResult}! YOU WIN! (Tx: ${txId.substring(0, 6)}...)`);
        } else {
          setStatus(`❌ You rolled a ${rollResult}. House wins! (Tx: ${txId.substring(0, 6)}...)`);
        }
        setIsRolling(false);
      }, 600);

    } catch (err) {
      console.error(err);
      const errMsg = err?.message || err?.toString() || 'Transaction rejected';
      setStatus(`Failed: ${errMsg.substring(0, 80)}`);
      setIsRolling(false);
    }
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
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Predict <strong>4, 5, or 6</strong> to win!</p>

        {/* Wallet Selection */}
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
          {isRolling ? 'Processing Bet...' : 'Bet 1 ALGO & Roll'}
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
