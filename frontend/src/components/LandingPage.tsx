import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
    const [text, setText] = useState('');
    const fullText = "Solana's Smart Wallet";

    useEffect(() => {
        let index = 0;
        const intervalId = setInterval(() => {
            setText(fullText.slice(0, index));
            index++;
            if (index > fullText.length) {
                clearInterval(intervalId);
            }
        }, 100); // Adjust the speed of typing here

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="min-h-screen w-screen bg-gradient-to-br from-black to-gray-900 text-white">
            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32 text-center">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
                    <span className={`inline-block min-w-[1ch] ${text.length < fullText.length ? 'border-r-4 border-white animate-blink' : ''}`}>
                        {text}
                    </span>
                </h1>
                <p className="text-xl sm:text-2xl md:text-3xl text-gray-300 mb-8">
                    Secure, Fast, and Intelligent Asset Management
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <Link
                        to="/app"
                        className="bg-white text-black hover:bg-gray-200 font-medium py-3 px-8 rounded-md transition duration-300 ease-in-out transform hover:scale-105 text-lg"
                    >
                        Launch App
                    </Link>
                    <a
                        href="#features"
                        className="bg-transparent border border-white text-white hover:bg-white hover:text-black font-medium py-3 px-8 rounded-md transition duration-300 ease-in-out transform hover:scale-105 text-lg"
                    >
                        Learn More
                    </a>
                </div>
            </div>

            {/* How It Works Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center bg-gray-900 rounded-lg">
                <h2 className="text-3xl sm:text-4xl font-bold mb-12">How It Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard
                        title="Create a Smart Wallet"
                        description="Easily create your smart wallet to start managing your assets securely."
                        icon="📝"
                    />
                    <FeatureCard
                        title="Deposit Funds"
                        description="Deposit funds into your smart wallet to get started with seamless transactions."
                        icon="💸"
                    />
                    <FeatureCard
                        title="Auto-Approve dApps"
                        description="Pre-approve trusted dApps to spend on your behalf with specified limits."
                        icon="🤖"
                    />

                </div>
            </div>


            {/* Problem & Solution Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-8 text-center">The Problem We Solve</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-2xl font-semibold mb-4 text-red-400">The Challenge</h3>
                        <ul className="list-none text-gray-300 space-y-2">
                            {[
                                "Frequent transaction approval requests disrupt user experience",
                                "Complex dApp interactions lead to approval fatigue",
                                "Security risks from hastily approved transactions",
                                "Limited control over dApp spending limits",
                                "Lack of transparency in approval processes"
                            ].map((item, index) => (
                                <li key={index} className="flex items-start">
                                    <span className="text-red-400 mr-2">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h3 className="text-2xl font-semibold mb-4 text-green-400">Our Solution</h3>
                        <ul className="list-none text-gray-300 space-y-2">
                            {[
                                "Smart pre-approval system for seamless dApp interactions",
                                "Granular control over approval limits and durations",
                                "Enhanced security with on-chain verification",
                                "Intuitive interface for managing multiple dApp approvals",
                                "Transparent, auditable approval history"
                            ].map((item, index) => (
                                <li key={index} className="flex items-start">
                                    <span className="text-green-400 mr-2">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <p className="text-lg text-gray-300 mt-8 text-center">
                    Solana's Smart Wallet revolutionizes dApp interactions by providing a secure, efficient, and user-friendly solution to the challenges of traditional blockchain wallets.
                </p>
            </div>


            {/* Key Features Section */}
            <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">Key Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard
                        title="Effortless Approvals"
                        description="Pre-approve dApp transactions to streamline the user experience."
                        icon="⚡"
                    />
                    <FeatureCard
                        title="Granular Control"
                        description="Specify spending limits and expiration dates for each dApp approval."
                        icon="🛠️"
                    />
                    <FeatureCard
                        title="Secure & Transparent"
                        description="All approvals are on-chain and verifiable with Solana's smart wallet."
                        icon="🔒"
                    />
                </div>
            </div>

            {/* Benefits Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                <h2 className="text-3xl sm:text-4xl font-bold mb-12">Why Choose Solana's Smart Wallet?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard
                        title="Save Time"
                        description="No more repeated confirmations—approve once and interact seamlessly."
                        icon="⏱️"
                    />
                    <FeatureCard
                        title="Total Control"
                        description="Control your assets, set limits, and decide who you trust."
                        icon="🛡️"
                    />
                    <FeatureCard
                        title="Fully Decentralized"
                        description="All actions are verifiable on-chain, ensuring security and trust."
                        icon="🌐"
                    />
                </div>
            </div>

            {/* Call to Action Section */}
            <div className="text-center py-16 bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg mt-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8">
                    Ready to take control of your dApp approvals?
                </h2>
                <Link
                    to="/app"
                    className="bg-white text-black hover:bg-gray-200 font-medium py-3 px-8 rounded-md transition duration-300 ease-in-out transform hover:scale-105 text-lg"
                >
                    Get Started Now
                </Link>
            </div>

            {/* Footer Section */}
            <footer className="bg-black bg-opacity-50 backdrop-filter backdrop-blur-lg border-t border-gray-800 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <p className="text-center text-gray-400">
                        © 2024 Solana's Smart Wallet. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

interface FeatureCardProps {
    title: string;
    description: string;
    icon: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon }) => {
    return (
        <div className="bg-gray-800 bg-opacity-50 rounded-lg p-6 text-center">
            <div className="text-4xl mb-4">{icon}</div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-300">{description}</p>
        </div>
    );
};

export default LandingPage;