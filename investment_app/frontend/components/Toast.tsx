
import { useEffect } from 'react';

type ToastProps = {
    message: string;
    onClose: () => void;
    duration?: number;
};

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 border border-blue-500">
                <span className="text-xl">✅</span>
                <span className="font-bold">{message}</span>
                <button
                    onClick={onClose}
                    className="ml-4 text-blue-200 hover:text-white"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
