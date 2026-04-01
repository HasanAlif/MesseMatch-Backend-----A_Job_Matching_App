import config from "../config";

export const LANDING_PAGE_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.site_name || "MesseMatch"} - Job Matching Platform</title>
    <style>
        :root {
            --bg-color: #1A283A;
            --card-bg-dark: rgba(20, 35, 55, 0.95);
            --card-bg-light: rgba(30, 50, 75, 0.95);
            --text-primary: #f5f0ff;
            --text-secondary: #b8c5d6;
            --accent-primary: #E47B35;
            --accent-coral: #FF9555;
            --accent-gold: #FFB366;
            --gradient-match: linear-gradient(135deg, #E47B35, #FF9555, #FFB366);
            --gradient-primary: linear-gradient(135deg, #E47B35, #FF8844);
            --gradient-accent: linear-gradient(135deg, #FFB366, #E47B35);
            --gradient-white: linear-gradient(135deg, #ffffff, #f5f7fa);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow-x: hidden;
            background-image:
                radial-gradient(circle at 15% 25%, rgba(228, 123, 53, 0.12) 0%, transparent 35%),
                radial-gradient(circle at 85% 75%, rgba(255, 149, 85, 0.1) 0%, transparent 35%),
                radial-gradient(circle at 50% 50%, rgba(255, 179, 102, 0.08) 0%, transparent 50%);
        }

        /* Floating Particles */
        .salon-particles {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none;
            z-index: 0;
        }
        .particle {
            position: absolute;
            opacity: 0;
            animation: floatParticle 18s linear infinite;
        }
        @keyframes floatParticle {
            0%   { transform: translateY(110vh) rotate(0deg) scale(0.8); opacity: 0; }
            8%   { opacity: 1; }
            90%  { opacity: 0.8; }
            100% { transform: translateY(-15vh) rotate(360deg) scale(1.1); opacity: 0; filter: drop-shadow(0 0 8px rgba(228, 123, 53, 0.5)); }
        }

        /* Hero Banner */
        .hero {
            text-align: center;
            margin-bottom: 3rem;
            padding: 0 1rem;
        }
        .hero-logo {
            font-size: 3.5rem;
            margin-bottom: 0.4rem;
            animation: spinLogo 6s ease-in-out infinite;
            display: inline-block;
        }
        @keyframes spinLogo {
            0%, 100% { transform: rotate(-10deg) scale(1); filter: drop-shadow(0 0 8px rgba(228, 123, 53, 0.4)); }
            50%       { transform: rotate(10deg) scale(1.1); filter: drop-shadow(0 0 16px rgba(255, 149, 85, 0.7)); }
        }
        .hero h1 {
            font-size: clamp(2rem, 5vw, 3.2rem);
            font-weight: 900;
            letter-spacing: -1px;
            line-height: 1.15;
            margin-bottom: 0.6rem;
        }
        .hero p {
            font-size: 1.1rem;
            color: var(--text-secondary);
            max-width: 500px;
            margin: 0 auto;
            line-height: 1.6;
        }
        .tagline-divider {
            width: 60px;
            height: 3px;
            background: var(--gradient-match);
            border-radius: 2px;
            margin: 1rem auto;
        }

        .stage {
            width: 100%;
            max-width: 1200px;
            padding: 2rem;
            z-index: 1;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
            gap: 1.8rem;
        }

        .card {
            padding: 2.2rem;
            border-radius: 24px;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(228, 123, 53, 0.15);
            backdrop-filter: blur(14px);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.25);
        }
        .card::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 24px;
            background: linear-gradient(135deg, rgba(228, 123, 53, 0.06), transparent 60%);
            pointer-events: none;
        }
        .card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6),
                        0 0 25px rgba(228, 123, 53, 0.25),
                        0 0 50px rgba(255, 149, 85, 0.12);
            border-color: rgba(228, 123, 53, 0.4);
        }
        .card.light { background-color: var(--card-bg-light); }
        .card.dark  { background-color: var(--card-bg-dark); }

        h2 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.8rem;
            line-height: 1.3;
        }
        p.lead {
            font-size: 1rem;
            color: var(--text-secondary);
            line-height: 1.65;
        }

        .gtext {
            background: var(--gradient-match);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-weight: 900;
            display: inline-block;
        }
        .gtext2 {
            background: var(--gradient-white);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-weight: 900;
            display: inline-block;
        }

        /* Animated Icon Circle */
        .icon-container {
            width: 75px;
            height: 75px;
            background: linear-gradient(135deg, rgba(228, 123, 53, 0.15), rgba(255, 149, 85, 0.1));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.4rem;
            font-size: 2.2rem;
            border: 1px solid rgba(228, 123, 53, 0.25);
            animation: pulseMatch 3s ease-in-out infinite;
        }
        @keyframes pulseMatch {
            0%   { box-shadow: 0 0 0 0 rgba(228, 123, 53, 0.4); border-color: rgba(228, 123, 53, 0.25); }
            50%  { box-shadow: 0 0 0 15px rgba(228, 123, 53, 0); border-color: rgba(255, 149, 85, 0.6); }
            100% { box-shadow: 0 0 0 0 rgba(228, 123, 53, 0); border-color: rgba(228, 123, 53, 0.25); }
        }

        /* Animated Wrapper */
        .animated-wrapper {
            position: relative;
            display: inline-block;
        }
        .sparkle {
            position: absolute;
            font-size: 0.9rem;
            opacity: 0;
            animation: sparkleAnim 2.5s ease-in-out infinite;
        }
        .sparkle:nth-child(1) { top: -14px; left: -10px; animation-delay: 0s; }
        .sparkle:nth-child(2) { top: -14px; right: -10px; animation-delay: 0.5s; }
        .sparkle:nth-child(3) { bottom: -10px; left: 50%; transform: translateX(-50%); animation-delay: 1s; }
        @keyframes sparkleAnim {
            0%, 100% { opacity: 0; transform: scale(0.4) translateY(0); filter: drop-shadow(0 0 4px rgba(228, 123, 53, 0)); }
            50% { opacity: 1; transform: scale(1.2) translateY(-6px); filter: drop-shadow(0 0 8px rgba(228, 123, 53, 0.6)); }
        }

        /* Status Badge */
        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.45rem 1.1rem;
            background: rgba(40, 167, 69, 0.12);
            border: 1px solid rgba(40, 167, 69, 0.4);
            border-radius: 50px;
            color: #4cd964;
            font-size: 0.88rem;
            font-weight: 600;
            margin-top: 1.4rem;
            transition: all 0.3s ease;
        }
        .status-badge:hover {
            background: rgba(40, 167, 69, 0.22);
            box-shadow: 0 0 16px rgba(76, 217, 100, 0.3);
        }
        .status-dot {
            width: 9px;
            height: 9px;
            background-color: #4cd964;
            border-radius: 50%;
            margin-right: 9px;
            box-shadow: 0 0 8px #4cd964;
            animation: blink 2s ease-in-out infinite;
        }
        @keyframes blink {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.75); }
        }

        /* Skills list */
        .skills-list {
            list-style: none;
            margin-top: 1rem;
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .skills-list li {
            background: rgba(228, 123, 53, 0.12);
            border: 1px solid rgba(228, 123, 53, 0.25);
            border-radius: 30px;
            padding: 0.3rem 0.85rem;
            font-size: 0.82rem;
            color: #FFB366;
            font-weight: 500;
            transition: all 0.3s;
        }
        .skills-list li:hover {
            background: rgba(228, 123, 53, 0.25);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(228, 123, 53, 0.3);
        }

        /* Match visual */
        .matches-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 7px;
            margin-bottom: 1.4rem;
        }
        .match {
            height: 26px;
            border-radius: 6px;
            animation: fillMatch 1.2s ease forwards;
            transform: scaleX(0);
            transform-origin: left;
        }
        .match.found  { background: linear-gradient(135deg, #E47B35, #FF9555); }
        .match.pending { background: rgba(228, 123, 53, 0.3); border: 1px solid rgba(228, 123, 53, 0.4); }
        .match:nth-child(1)  { animation-delay: 0.05s; }
        .match:nth-child(2)  { animation-delay: 0.15s; }
        .match:nth-child(3)  { animation-delay: 0.25s; }
        .match:nth-child(4)  { animation-delay: 0.35s; }
        .match:nth-child(5)  { animation-delay: 0.45s; }
        .match:nth-child(6)  { animation-delay: 0.55s; }
        .match:nth-child(7)  { animation-delay: 0.65s; }
        .match:nth-child(8)  { animation-delay: 0.75s; }
        .matches-legend { display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-secondary); }
        .legend-dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; margin-right: 5px; vertical-align: middle; }
        @keyframes fillMatch {
            to { transform: scaleX(1); filter: drop-shadow(0 2px 6px rgba(228, 123, 53, 0.5)); }
        }

        /* Star rating */
        .stars {
            display: flex;
            gap: 4px;
            margin-bottom: 1rem;
            font-size: 1.3rem;
        }
        .star {
            animation: starPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            transform: scale(0);
            opacity: 0;
        }
        .star:nth-child(1) { animation-delay: 0.1s; }
        .star:nth-child(2) { animation-delay: 0.2s; }
        .star:nth-child(3) { animation-delay: 0.3s; }
        .star:nth-child(4) { animation-delay: 0.4s; }
        .star:nth-child(5) { animation-delay: 0.5s; }
        @keyframes starPop {
            to { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 4px rgba(228, 123, 53, 0.6)); }
        }

    </style>
</head>
<body>
    <div class="salon-particles" id="particles"></div>

    <main class="stage">

        <!-- Hero -->
        <div class="hero">
            <div class="hero-logo">🔗</div>
            <h1><span class="gtext">Welcome to</span> <span class="gtext2">Messe</span><span class="gtext">Match</span></h1>
            <div class="tagline-divider"></div>
            <p>Smart job matching platform for installers and companies</p>
        </div>

        <section>
            <div class="grid">

                <!-- Platform Hub Card -->
                <article class="card light">
                    <div class="icon-container">
                        <div class="animated-wrapper">
                            <span class="sparkle">✨</span>
                            <span class="sparkle">💫</span>
                            <span class="sparkle">⭐</span>
                            👷
                        </div>
                    </div>
                    <h2>Find Perfect <span class="gtext">Matches</span></h2>
                    <p class="lead">Connect skilled installers with companies that need them. Build verified profiles and grow your business effortlessly.</p>
                    <ul class="skills-list">
                        <li>⚡ Electrical</li>
                        <li>❄️ HVAC</li>
                        <li>☀️ Solar</li>
                        <li>🔧 Plumbing</li>
                        <li>🏗️ General</li>
                    </ul>
                </article>

                <!-- Server Status Card -->
                <article class="card dark">
                    <div class="icon-container">🚀</div>
                    <h2>Server <span class="gtext">Status</span></h2>
                    <p class="lead">All MesseMatch backend services are fully operational and ready to match installers with jobs in real time.</p>
                    <div class="status-badge">
                        <span class="status-dot"></span>
                        System Online
                    </div>
                </article>

                <!-- Developer Card -->
                <article class="card light">
                    <div class="stars">
                        <span class="star">⭐</span>
                        <span class="star">⭐</span>
                        <span class="star">⭐</span>
                        <span class="star">⭐</span>
                        <span class="star">⭐</span>
                    </div>
                    <div class="icon-container">👨‍💻</div>
                    <h2>Built by <span class="gtext">Alif</span></h2>
                    <p class="lead">Engineered with passion using Node.js, Express & TypeScript — optimized for intelligent job matching and seamless hiring.</p>
                </article>

            </div>
        </section>
    </main>

    <script>
        // Floating match-themed particles
        const icons = ['🔗', '👷', '🏢', '⚡', '💼', '🎯', '✨', '🚀', '💻', '🤝'];
        const container = document.getElementById('particles');

        for (let i = 0; i < 22; i++) createParticle();

        function createParticle() {
            const el = document.createElement('div');
            el.classList.add('particle');
            el.innerText = icons[Math.floor(Math.random() * icons.length)];
            el.style.left = Math.random() * 100 + 'vw';
            el.style.fontSize = (Math.random() * 1.2 + 0.8) + 'rem';
            el.style.animationDuration = (Math.random() * 12 + 14) + 's';
            el.style.animationDelay = (Math.random() * 8) + 's';
            el.style.filter = 'opacity(0.35)';
            container.appendChild(el);
        }
    </script>
</body>
</html>
`;

export const PASSWORD_RESET_TEMPLATE = (otp: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset OTP</title>
    <style>
        body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0; }
        .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #E47B35, #FF9555, #FFB366); padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .body { padding: 32px; text-align: center; }
        .otp-code { display: inline-block; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #E47B35; background: linear-gradient(135deg, rgba(228, 123, 53, 0.08), rgba(255, 149, 85, 0.08)); padding: 16px 32px; border-radius: 8px; margin: 24px 0; border: 1px solid rgba(228, 123, 53, 0.2); }
        .body p { color: #555; font-size: 15px; line-height: 1.6; margin: 8px 0; }
        .footer { text-align: center; padding: 20px 32px; background: #fafafa; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${config.site_name || "MesseMatch"}</h1>
        </div>
        <div class="body">
            <h2>Reset Your Password</h2>
            <p>You requested a password reset for your ${config.site_name || "MesseMatch"} account. Use the OTP below to proceed:</p>
            <div class="otp-code">${otp}</div>
            <p>This code expires in 1 minute. If you did not request this, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${config.site_name || "MesseMatch"} — Smart Job Matching Platform</p>
        </div>
    </div>
</body>
</html>
`;

export const EMAIL_VERIFICATION_TEMPLATE = (otp: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification OTP</title>
    <style>
        body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0; }
        .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #E47B35, #FF9555, #FFB366); padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .body { padding: 32px; text-align: center; }
        .otp-code { display: inline-block; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #E47B35; background: linear-gradient(135deg, rgba(228, 123, 53, 0.08), rgba(255, 149, 85, 0.08)); padding: 16px 32px; border-radius: 8px; margin: 24px 0; border: 1px solid rgba(228, 123, 53, 0.2); }
        .body p { color: #555; font-size: 15px; line-height: 1.6; margin: 8px 0; }
        .footer { text-align: center; padding: 20px 32px; background: #fafafa; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${config.site_name || "MesseMatch"}</h1>
        </div>
        <div class="body">
            <h2>Verify Your Email</h2>
            <p>Welcome to <strong>${config.site_name || "MesseMatch"}</strong>! Complete your registration by verifying your email. Use the OTP below:</p>
            <div class="otp-code">${otp}</div>
            <p>This code expires in 1 minute. If you did not create an account, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${config.site_name || "MesseMatch"} — Smart Job Matching Platform</p>
        </div>
    </div>
</body>
</html>
`;
