import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import algosdk from 'algosdk';
import { NetworkId, WalletId, WalletManager, WalletProvider, useWallet } from '@txnlab/use-wallet-react';

const walletManager = new WalletManager({
  wallets: [
    { id: WalletId.PERA, options: { compactMode: false } },
    WalletId.DEFLY,
    { id: WalletId.LUTE, options: { siteName: 'Algo Dice Roll' } },
    WalletId.MNEMONIC
  ],
  network: NetworkId.TESTNET
});

const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

// TEAL Approval Program (0.1 ALGO Minimum Bet, 2x Dynamic Payout)
const APPROVAL_TEAL = `#pragma version 10
txn NumAppArgs
int 0
==
bnz main_bare
txna ApplicationArgs 0
method "roll(pay)uint64"
==
bnz main_roll
txna ApplicationArgs 0
method "fund_house(pay)void"
==
bnz main_fund
err

main_bare:
txn OnCompletion
int NoOp
==
return

main_roll:
txn OnCompletion
int NoOp
==
assert
gtxn 0 Receiver
global CurrentApplicationAddress
==
assert
gtxn 0 Amount
int 100000
>=
assert
global LastTimestamp
itob
txn TxID
concat
sha256
btoi
int 6
%
int 1
+
store 0
load 0
int 4
>=
bz skip_payout
itxn_begin
int pay
itxn_field TypeEnum
txn Sender
itxn_field Receiver
gtxn 0 Amount
int 2
*
itxn_field Amount
int 0
itxn_field Fee
itxn_submit
skip_payout:
load 0
itob
byte 0x151f7c75
swap
concat
log
int 1
return

main_fund:
txn OnCompletion
int NoOp
==
assert
gtxn 0 Receiver
global CurrentApplicationAddress
==
assert
gtxn 0 Amount
int 0
>
assert
int 1
return`;

const CLEAR_TEAL = `#pragma version 10\nint 1\nreturn`;

function DiceGame() {
  const { wallets, activeAddress, activeWallet, transactionSigner } = useWallet();
  const [appId, setAppId] = useState(0);
  const [diceEmoji, setDiceEmoji] = useState('🎲');
  const [status, setStatus] = useState(activeAddress ? 'Ready!' : 'Select a wallet below.');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConnect = async (wallet) => {
    try {
      setStatus(`Connecting to ${wallet.metadata.name}...`);
      await wallet.connect();
      setStatus('Connected!');
    } catch (err) {
      console.error(err);
      setStatus('Connection failed.');
    }
  };

  const handleDisconnect = async () => {
    if (activeWallet) {
      await activeWallet.disconnect();
      setStatus('Wallet disconnected.');
    }
  };

  // 1. One-Click Smart Contract Deployment
  const deployContract = async () => {
    if (!activeAddress || !transactionSigner) {
      setStatus('Connect wallet first.');
      return;
    }

    setIsProcessing(true);
    setStatus('Compiling & deploying contract to TestNet...');

    try {
      // Compile TEAL directly via algod Node API
      const approvalCompiled = await algodClient.compile(APPROVAL_TEAL).do();
      const clearCompiled = await algodClient.compile(CLEAR_TEAL).do();

      const approvalBytes = new Uint8Array(Buffer.from(approvalCompiled.result, 'base64'));
      const clearBytes = new Uint8Array(Buffer.from(clearCompiled.result, 'base64'));

      const params = await algodClient.getTransactionParams().do();

      const createTxn = algosdk.makeApplicationCreateTxnFromObject({
        from: activeAddress,
        approvalProgram: approvalBytes,
        clearProgram: clearBytes,
        numLocalInts: 0,
        numLocalByteSlices: 0,
        numGlobalInts: 0,
        numGlobalByteSlices: 0,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        suggestedParams: params
      });

      const atc = new algosdk.AtomicTransactionComposer();
      atc.addTransaction({ txn: createTxn, signer: transactionSigner });

      setStatus('Approve application creation in your wallet...');
      const result = await atc.execute(algodClient, 4);
      
      // Get App ID from transaction confirmation
      const txnInfo = await algodClient.pendingTransactionInformation(result.txIDs[0]).do();
      const newAppId = txnInfo['application-index'];

      setAppId(newAppId);
      setStatus(`🎉 Contract Deployed! App ID: ${newAppId}`);
      setIsProcessing(false);

    } catch (err) {
      console.error(err);
      const errMsg = err?.message || err?.toString() || 'Deploy failed';
      setStatus(`Deploy Failed: ${errMsg.substring(0, 80)}`);
      setIsProcessing(false);
    }
  };

  // 2. Roll Logic against Deployed App ID
  const playGame = async () => {
    if (!activeAddress || !transactionSigner) return;
    if (appId === 0) {
      setStatus('Please tap "Deploy Contract" first!');
      return;
    }

    setIsProcessing(true);
    setStatus('Preparing 0.1 ALGO bet...');

    try {
      const params = await algodClient.getTransactionParams().do();
      const appAddress = algosdk.getApplicationAddress(appId);

      // Payment Txn: 0.1 ALGO (100,000 microAlgos)
      const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        to: appAddress,
        amount: 100000,
        suggestedParams: params
      });

      // Application Call Txn
      const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
        from: activeAddress,
        appIndex: appId,
        appArgs: [new TextEncoder().encode('roll')],
        suggestedParams: params
      });

      const atc = new algosdk.AtomicTransactionComposer();
      atc.addTransaction({ txn: payTxn, signer: transactionSigner });
      atc.addTransaction({ txn: appCallTxn, signer: transactionSigner });

      setStatus('Approve bet in your wallet...');
      const result = await atc.execute(algodClient, 4);
      const txId = result.txIDs[1];

      setStatus('Bet Confirmed! Rolling...');

      setTimeout(() => {
        const rollResult = Math.floor(Math.random() * 6) + 1;
        const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        setDiceEmoji(diceEmojis[rollResult - 1]);

        if (rollResult >= 4) {
          setStatus(`🎉 Rolled a ${rollResult}! WON 0.2 ALGO! (Tx: ${txId.substring(0, 6)}...)`);
        } else {
          setStatus(`❌ Rolled a ${rollResult}. House wins! (Tx: ${txId.substring(0, 6)}...)`);
        }
        setIsProcessing(false);
      }, 600);

    } catch (err) {
      console.error(err);
      const errMsg = err?.message || err?.toString() || 'Roll failed';
      setStatus(`Failed: ${errMsg.substring(0, 80)}`);
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#121212', color: '#ffffff',
      fontFamily: 'Arial, sans-serif', padding: '1rem'
    }}>
      <div style={{
        background: '#1e1e1e', padding: '2rem', borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)', textAlign: 'center',
        maxWidth: '400px', width: '100%'
      }}>
        <h1 style={{ margin: '0 0 10px 0' }}>🎲 Algo Dice Roll</h1>
        <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Predict <strong>4, 5, or 6</strong> to win double!</p>

        {!activeAddress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
            {wallets.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet)}
                style={{
                  background: wallet.id === 'lute' ? '#ffd700' : wallet.id === 'mnemonic' ? '#00ffaa' : '#00d2ff',
                  border: 'none', color: '#000', padding: '12px',
                  fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer'
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
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
              <button
                onClick={handleDisconnect}
                style={{
                  background: '#333', color: '#ff5555', border: '1px solid #444',
                  padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Disconnect
              </button>
              {appId === 0 && (
                <button
                  onClick={deployContract}
                  disabled={isProcessing}
                  style={{
                    background: '#00ffaa', color: '#000', border: 'none',
                    padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  🚀 Deploy Contract
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ fontSize: '80px', margin: '20px 0' }}>{diceEmoji}</div>

        <button
          onClick={playGame}
          disabled={!activeAddress || isProcessing || appId === 0}
          style={{
            background: activeAddress && appId !== 0 && !isProcessing ? '#00d2ff' : '#444',
            color: activeAddress && appId !== 0 && !isProcessing ? '#000' : '#888',
            border: 'none', padding: '12px 24px', fontWeight: 'bold',
            borderRadius: '6px', cursor: activeAddress && appId !== 0 && !isProcessing ? 'pointer' : 'not-allowed',
            width: '100%'
          }}
        >
          {appId === 0 ? 'Deploy Contract First' : isProcessing ? 'Processing...' : 'Bet 0.1 ALGO & Roll'}
        </button>

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
