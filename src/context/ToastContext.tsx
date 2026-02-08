import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'info' | 'error';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = `${Date.now()}-${Math.random()}`;
        const newToast: Toast = { id, message, type };

        setToasts((prev) => [...prev, newToast]);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return <CheckCircle2 size={18} />;
            case 'info':
                return <Info size={18} />;
            case 'error':
                return <AlertCircle size={18} />;
        }
    };

    const getStyles = (type: ToastType) => {
        switch (type) {
            case 'success':
                return 'bg-green-500/20 border-green-500/50 text-green-400';
            case 'info':
                return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
            case 'error':
                return 'bg-red-500/20 border-red-500/50 text-red-400';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg animate-in slide-in-from-right duration-300 ${getStyles(toast.type)}`}
                    >
                        {getIcon(toast.type)}
                        <span className="text-sm font-medium text-white flex-1">
                            {toast.message}
                        </span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-white/60 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
