import React from 'react';
import { ArrowRightIcon, QuestionMarkCircleIcon, ArrowDownIcon } from './icons';

interface PurchaseRequestProps {
    onBack: () => void;
}

const PurchaseRequest: React.FC<PurchaseRequestProps> = ({ onBack }) => {

    const goldenGradient = 'linear-gradient(to bottom right, #c09a3e, #856a3d)';

    return (
        <>
            <div className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-10 items-center justify-center pointer-events-none" style={{ left: 'calc((100vw - 65vw) / 4)'}}>
                <ArrowRightIcon className="w-10 h-10 text-dark-gold-gradient animate-pulse" />
            </div>
            <div className="w-full lg:w-[65%] mx-auto rounded-2xl p-[2px] bg-gradient-to-br from-[#c09a3e] to-[#856a3d] mt-4">
                <div 
                    className="w-full h-full text-center rounded-[calc(1rem-2px)] p-6 sm:p-8 flex flex-col"
                    style={{ backgroundImage: 'var(--color-background-container-gradient)' }}
                >
                    <div className="flex justify-between items-center mb-8 flex-shrink-0">
                        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{ backgroundImage: goldenGradient }}>
                            <ArrowRightIcon className="w-5 h-5"/>
                            <span>العودة</span>
                        </button>
                        <h2 className="text-4xl font-bold golden-text flex items-center gap-3">
                            <QuestionMarkCircleIcon className="w-10 h-10"/>
                            طلب شراء التطبيق
                        </h2>
                        <div className="w-24 flex items-center justify-center">
                            <ArrowDownIcon className="w-10 h-10 text-dark-gold-gradient animate-bounce-down" />
                        </div>
                    </div>

                    <div className="text-lg text-center p-6 mb-8 bg-black/5 rounded-lg border border-[var(--color-border-primary)] flex-shrink-0">
                        <p className="font-bold text-dark-gold-gradient text-2xl">ارتقِ بتجربتك التعليمية إلى المستوى التالي</p>
                        <p className="text-base text-[var(--color-text-secondary)] mt-3 max-w-2xl mx-auto">
                            للحصول على تجربة سلسة وميزات حصرية ودعم فني متكامل، يرجى ملء النموذج أدناه لإرسال طلبك. سنتواصل معك في أقرب وقت ممكن لإتمام عملية الشراء.
                        </p>
                    </div>
                    
                    <div className="flex-grow flex flex-col w-full min-h-[600px]">
                        <iframe
                            src="https://forms.gle/QigTduLuXRFvGZZC9"
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            marginHeight={0}
                            marginWidth={0}
                            className="flex-grow rounded-b-lg"
                            title="نموذج طلب الشراء"
                        >
                            جاري تحميل النموذج...
                        </iframe>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PurchaseRequest;