
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { unlockTrade, placeOrder, getAccountInfo, OrderRequest } from '@/lib/api';

interface TradingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialSymbol?: string;
}

export default function TradingDialog({ isOpen, onClose, initialSymbol }: TradingDialogProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState<'UNLOCK' | 'ORDER'>('UNLOCK');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [account, setAccount] = useState<any>(null);

    // Order Form
    const [symbol, setSymbol] = useState(initialSymbol || '');
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [orderType, setOrderType] = useState<string>('NORMAL');
    const [qty, setQty] = useState<number>(0);
    const [price, setPrice] = useState<number>(0);
    const [stopPrice, setStopPrice] = useState<number>(0);
    const [tif, setTif] = useState<'DAY' | 'GTC'>('DAY');
    const [fillOutsideRth, setFillOutsideRth] = useState(false);

    // Advanced
    const [stopLossEnabled, setStopLossEnabled] = useState(false);
    const [stopLossPrice, setStopLossPrice] = useState<number>(0);
    // Trailing
    const [trailType, setTrailType] = useState<'RATIO' | 'AMOUNT'>('RATIO');
    const [trailValue, setTrailValue] = useState<number>(0);
    const [trailSpread, setTrailSpread] = useState<number>(0);

    useEffect(() => {
        if (isOpen && initialSymbol) {
            setSymbol(initialSymbol);
        }
    }, [isOpen, initialSymbol]);

    // Check if already unlocked (by trying to get account info)
    useEffect(() => {
        if (isOpen) {
            checkUnlockStatus();
        }
    }, [isOpen]);

    const checkUnlockStatus = async () => {
        try {
            const info = await getAccountInfo();
            if (info) {
                setAccount(info);
                setStep('ORDER');
            }
        } catch (e) {
            // Not unlocked or error
            setStep('UNLOCK');
        }
    };

    const handleUnlock = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await unlockTrade(password);
            if (res.status === 'success') {
                setStep('ORDER');
                checkUnlockStatus();
            } else {
                setError(res.message);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitOrder = async () => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const req: OrderRequest = {
                symbol,
                side,
                qty,
                order_type: orderType as any,
                price: orderType !== 'MARKET' ? price : undefined,
                stop_price: ['STOP', 'STOP_LIMIT'].includes(orderType) ? stopPrice : undefined,
                time_in_force: tif,
                fill_outside_rth: fillOutsideRth,
                stop_loss_enabled: side === 'BUY' && stopLossEnabled,
                stop_loss_price: stopLossPrice,
                trail_type: ['TRAILING_STOP', 'TRAILING_STOP_LIMIT'].includes(orderType) ? trailType : undefined,
                trail_value: ['TRAILING_STOP', 'TRAILING_STOP_LIMIT'].includes(orderType) ? trailValue : undefined,
                trail_spread: orderType === 'TRAILING_STOP_LIMIT' ? trailSpread : undefined
            };

            const res = await placeOrder(req);
            if (res.status === 'success') {
                setSuccessMsg(res.message);
                // Refresh account info
                checkUnlockStatus();
            } else {
                setError(res.msg || 'Order failed');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md shadow-xl text-white">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">米国株取引 (Moomoo)</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>

                {error && <div className="bg-red-900/50 text-red-200 p-2 mb-4 rounded text-sm">{error}</div>}
                {successMsg && <div className="bg-green-900/50 text-green-200 p-2 mb-4 rounded text-sm">{successMsg}</div>}

                {step === 'UNLOCK' ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-400">取引パスワードを入力してロックを解除してください。</p>
                        <input
                            type="password"
                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
                            placeholder="取引パスワード"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button
                            onClick={handleUnlock}
                            disabled={loading || !password}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                        >
                            {loading ? '解除中...' : 'ロック解除'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                        {account && (
                            <div className="text-xs bg-gray-800 p-2 rounded flex justify-between">
                                <span>購買力: ${account.power?.toFixed(2)}</span>
                                <span>現金: ${account.cash?.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-gray-400">銘柄</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                    value={symbol}
                                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">売買</label>
                                <select
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                    value={side}
                                    onChange={e => setSide(e.target.value as any)}
                                >
                                    <option value="BUY">買 (BUY)</option>
                                    <option value="SELL">売 (SELL)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-gray-400">注文タイプ</label>
                                <select
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                    value={orderType}
                                    onChange={e => setOrderType(e.target.value)}
                                >
                                    <option value="NORMAL">指値 (Limit)</option>
                                    <option value="MARKET">成行 (Market)</option>
                                    <option value="STOP">逆指値 (Stop)</option>
                                    <option value="STOP_LIMIT">Stop Limit</option>
                                    <option value="TRAILING_STOP">Trailing Stop</option>
                                    <option value="TRAILING_STOP_LIMIT">Trailing Stop Limit</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">数量</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                    value={qty}
                                    onChange={e => setQty(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        {orderType !== 'MARKET' && (
                            <div>
                                <label className="text-xs text-gray-400">指値価格 ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                    value={price}
                                    onChange={e => setPrice(Number(e.target.value))}
                                />
                            </div>
                        )}

                        {['STOP', 'STOP_LIMIT'].includes(orderType) && (
                            <div>
                                <label className="text-xs text-gray-400">トリガー価格 ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                    value={stopPrice}
                                    onChange={e => setStopPrice(Number(e.target.value))}
                                />
                            </div>
                        )}

                        {['TRAILING_STOP', 'TRAILING_STOP_LIMIT'].includes(orderType) && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-400">トレールタイプ</label>
                                    <select
                                        className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                        value={trailType}
                                        onChange={e => setTrailType(e.target.value as any)}
                                    >
                                        <option value="RATIO">比率 (%)</option>
                                        <option value="AMOUNT">金額 ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">トレール幅</label>
                                    <input
                                        type="number"
                                        step={trailType === 'RATIO' ? "0.1" : "0.01"}
                                        className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                        value={trailValue}
                                        onChange={e => setTrailValue(Number(e.target.value))}
                                        placeholder={trailType === 'RATIO' ? '例: 1.0 (=1%)' : '0.50'}
                                    />
                                </div>
                            </div>
                        )}

                        {orderType === 'TRAILING_STOP_LIMIT' && (
                            <div>
                                <label className="text-xs text-gray-400">トレールスプレッド ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                    value={trailSpread}
                                    onChange={e => setTrailSpread(Number(e.target.value))}
                                    placeholder="トリガー価格との差 (例: 0.50)"
                                />
                            </div>
                        )}

                        {/* Advanced Options Toggle? No, show always if relevant */}
                        <div className="pt-2 border-t border-gray-700">
                            <label className="flex items-center space-x-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={fillOutsideRth}
                                    onChange={e => setFillOutsideRth(e.target.checked)}
                                />
                                <span>時間外取引を許可 (ETH)</span>
                            </label>
                            <label className="flex items-center space-x-2 text-sm mt-1">
                                <input
                                    type="checkbox"
                                    checked={tif === 'GTC'}
                                    onChange={e => setTif(e.target.checked ? 'GTC' : 'DAY')}
                                />
                                <span>GTC (キャンセルまで有効)</span>
                            </label>
                        </div>

                        {/* Simultaneous Stop Loss */}
                        {side === 'BUY' && (
                            <div className="pt-2 border-t border-gray-700 bg-gray-800/50 p-2 rounded">
                                <label className="flex items-center space-x-2 text-sm font-bold text-yellow-400">
                                    <input
                                        type="checkbox"
                                        checked={stopLossEnabled}
                                        onChange={e => setStopLossEnabled(e.target.checked)}
                                    />
                                    <span>同時に損切り注文を発注 (Sell Stop/GTC)</span>
                                </label>
                                {stopLossEnabled && (
                                    <div className="mt-2">
                                        <label className="text-xs text-gray-400">損切りトリガー価格 ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2"
                                            value={stopLossPrice}
                                            onChange={e => setStopLossPrice(Number(e.target.value))}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handleSubmitOrder}
                            disabled={loading}
                            className={`w-full font-bold py-2 px-4 rounded disabled:opacity-50 mt-4 ${side === 'BUY' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                                }`}
                        >
                            {loading ? '発注中...' : (side === 'BUY' ? '買い注文' : '売り注文')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
