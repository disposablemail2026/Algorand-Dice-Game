import React from 'react';
import ReactDOM from 'react-dom/client';
import { NetworkId, WalletId, WalletManager, WalletProvider, useWallet } from '@txnlab/use-wallet-react';

const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.LUTE],
  network: NetworkId.TESTNET
});

function App() {
  const { wallets, activeAddress } = useWallet();

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif', background: '#121212', color: '#fff', minHeight: '100vh' }}>
      <h1>🎲 Algo Dice Roll</h1>
      {activeAddress ? (
        <p>Connected: {activeAddress.substring(0, 8)}...</p>
      ) : (
        <div>
          {wallets.map((wallet) => (
            <button key={wallet.id} onClick={() => wallet.connect()} style={{ margin: '5px', padding: '10px 20px', cursor: 'pointer' }}>
              Connect {wallet.metadata.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <WalletProvider manager={walletManager}>
    <App />
  </WalletProvider>
);
