
import React, { useState, useEffect } from 'react';
import { XIcon } from './icons';

const Calculator: React.FC = () => {
    const [expression, setExpression] = useState('');
    const [display, setDisplay] = useState('0');
    const [memory, setMemory] = useState(0);

    const factorial = (n: number): number => {
        if (n < 0) return NaN;
        if (n === 0) return 1;
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    };
    
    const evaluateExpression = () => {
        if (!expression) return;
        try {
            let evalExpression = expression
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/π/g, 'Math.PI')
                .replace(/e/g, 'Math.E')
                .replace(/√\((.*?)\)/g, 'Math.sqrt($1)')
                .replace(/³√\((.*?)\)/g, 'Math.cbrt($1)')
                .replace(/log\((.*?)\)/g, 'Math.log10($1)')
                .replace(/ln\((.*?)\)/g, 'Math.log($1)')
                .replace(/(\d+)!/g, (_, num) => `factorial(${num})`)
                .replace(/sin\((.*?)\)/g, 'Math.sin(Math.PI/180*$1)')
                .replace(/cos\((.*?)\)/g, 'Math.cos(Math.PI/180*$1)')
                .replace(/tan\((.*?)\)/g, 'Math.tan(Math.PI/180*$1)')
                .replace(/asin\((.*?)\)/g, '(180/Math.PI*Math.asin($1))')
                .replace(/acos\((.*?)\)/g, '(180/Math.PI*Math.acos($1))')
                .replace(/atan\((.*?)\)/g, '(180/Math.PI*Math.atan($1))')
                .replace(/\^/g, '**');

            // This is a workaround for the factorial function to be available in eval's scope.
            // It's generally unsafe but constrained here.
            const result = new Function('factorial', `return ${evalExpression}`)(factorial);
            
            if (isNaN(result) || !isFinite(result)) {
                setDisplay('Error');
            } else {
                setDisplay(String(result));
            }
            setExpression(String(result));

        } catch (error) {
            setDisplay('Error');
            setExpression('');
        }
    };
    
    const handleButtonClick = (value: string, type: 'digit' | 'operator' | 'function' | 'action') => {
        if (display === 'Error') {
            setExpression('');
            setDisplay('0');
        }
        
        switch(type) {
            case 'digit':
                setExpression(prev => (prev === '0' ? value : prev + value));
                break;
            case 'operator':
                setExpression(prev => prev + value);
                break;
            case 'function':
                if (value.endsWith('(')) { // like sin(
                    setExpression(prev => prev + value);
                } else { // like x²
                     setExpression(prev => `(${prev})${value}`);
                }
                break;
            case 'action':
                switch(value) {
                    case 'AC':
                        setExpression('');
                        setDisplay('0');
                        break;
                    case 'DEL':
                        setExpression(prev => prev.slice(0, -1));
                        break;
                    case '=':
                        evaluateExpression();
                        break;
                    case 'M+':
                        try { setMemory(mem => mem + parseFloat(eval(expression))); } catch { /* ignore error */ }
                        break;
                    case 'M-':
                        try { setMemory(mem => mem - parseFloat(eval(expression))); } catch { /* ignore error */ }
                        break;
                    case 'MR':
                        setExpression(prev => prev + String(memory));
                        break;
                }
                break;
        }
    };

    useEffect(() => {
        if (expression === '') {
            setDisplay('0');
        } else {
            setDisplay(expression);
        }
    }, [expression]);

    const buttons = [
        { l: '(', t: 'operator' }, { l: ')', t: 'operator' }, { l: 'M+', t: 'action' }, { l: 'M-', t: 'action' }, { l: 'MR', t: 'action' },
        { l: 'x²', t: 'function', v: '^2' }, { l: 'x³', t: 'function', v: '^3' }, { l: 'xʸ', t: 'operator', v: '^' }, { l: 'eˣ', t: 'function', v: 'e^(' }, { l: '10ˣ', t: 'function', v: '10^(' },
        { l: '1/x', t: 'function', v: '1/(' }, { l: '√', t: 'function', v: '√(' }, { l: '³√', t: 'function', v: '³√(' }, { l: 'ln', t: 'function', v: 'ln(' }, { l: 'log', t: 'function', v: 'log(' },
        { l: '7', t: 'digit' }, { l: '8', t: 'digit' }, { l: '9', t: 'digit' }, { l: 'DEL', t: 'action', c: 'op-btn' }, { l: 'AC', t: 'action', c: 'op-btn' },
        { l: '4', t: 'digit' }, { l: '5', t: 'digit' }, { l: '6', t: 'digit' }, { l: '×', t: 'operator' }, { l: '÷', t: 'operator' },
        { l: '1', t: 'digit' }, { l: '2', t: 'digit' }, { l: '3', t: 'digit' }, { l: '+', t: 'operator' }, { l: '-', t: 'operator' },
        { l: '0', t: 'digit' }, { l: '.', t: 'operator' }, { l: 'π', t: 'operator' }, { l: 'e', t: 'operator' }, { l: '=', t: 'action', c: 'op-btn' },
        { l: 'sin', t: 'function', v: 'sin(' }, { l: 'cos', t: 'function', v: 'cos(' }, { l: 'tan', t: 'function', v: 'tan(' }, {l: 'x!', t: 'function', v: '!'}, {l:'Ans', t:'action'}
    ];
    
    return (
        <div className="w-full h-full flex items-center justify-center bg-[var(--color-background-primary)] rounded-lg">
            <div 
                className="bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-[2px] border border-gray-600"
                style={{backgroundImage: 'linear-gradient(145deg, #6b4f3a, #4a3a2a)'}}
            >
                <div className="bg-[#f3efe8] dark:bg-[#18191A] rounded-[calc(1rem-2px)] p-4 flex flex-col gap-4">
                    {/* Screen */}
                    <div className="text-right text-white p-4 rounded-lg bg-black/30 border border-gray-700 min-h-[100px] flex flex-col justify-between" style={{boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'}}>
                        <div className="text-gray-400 text-xl break-all h-1/2">{expression || ' '}</div>
                        <div className="text-5xl font-light break-all">{display}</div>
                    </div>

                    {/* Keypad */}
                    <div className="grid grid-cols-5 gap-2">
                        {buttons.map(({ l, t, v, c }) => (
                            <button key={l} onClick={() => handleButtonClick(v || l, t as any)} className={`calc-btn ${c || ''} ${t === 'digit' ? 'digit-btn' : t==='operator' ? 'op-btn' : 'func-btn' }`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                 <style>{`
                    .calc-btn {
                        @apply h-14 rounded-lg text-xl font-sans font-semibold transition-all duration-200 text-white shadow-md active:shadow-inner active:scale-95;
                        border: 1px solid rgba(0,0,0,0.2);
                    }
                    .light .digit-btn { background-color: #dcd6ce; color: #4a3a2a; border-bottom: 3px solid #b7b0a7; }
                    .light .digit-btn:active { border-bottom-width: 1px; }
                    .dark .digit-btn { background-color: #3b4252; border-bottom: 3px solid #2e3440; }
                    .dark .digit-btn:active { border-bottom: 1px solid #2e3440; }

                    .light .func-btn { background-color: #c8bdae; color: #4a3a2a; border-bottom: 3px solid #a99d8d; }
                    .light .func-btn:active { border-bottom-width: 1px; }
                    .dark .func-btn { background-color: #434c5e; border-bottom: 3px solid #3b4252; }
                    .dark .func-btn:active { border-bottom: 1px solid #3b4252; }
                    
                    .op-btn {
                       background-color: #cd7f32; /* Bronze */
                       border-bottom: 3px solid #a46628;
                    }
                     .op-btn:active {
                       border-bottom: 1px solid #a46628;
                    }
                `}</style>
            </div>
        </div>
    );
};

export default Calculator;
