"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Shield, 
  Lock, 
  FileSearch, 
  Scale, 
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Volume2,
  Eye,
  ScrollText
} from "lucide-react";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Feature cards data
const features = [
  {
    icon: Volume2,
    title: "Silence Protocol",
    description: "When confidence drops below 85%, RAGbox refuses to guess. No hallucinations. No liability.",
    color: "warning",
  },
  {
    icon: Lock,
    title: "Privilege Switch",
    description: "One-click attorney-client privilege mode. Protected documents become invisible to unauthorized queries.",
    color: "danger",
  },
  {
    icon: Shield,
    title: "Digital Fort Knox",
    description: "AES-256 encryption with customer-managed keys. Your documents stay yours. Period.",
    color: "primary",
  },
  {
    icon: ScrollText,
    title: "Unalterable Record",
    description: "Every query logged. Every answer hashed. SEC 17a-4 ready. HIPAA aware. Audit-ready from day one.",
    color: "primary",
  },
];

// Trust badges
const trustBadges = [
  "SEC 17a-4 Ready",
  "HIPAA Aware",
  "SOC 2 Compliant",
  "GDPR Ready",
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error("Waitlist signup failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Constellation Background */}
      <div className="absolute inset-0 constellation-bg opacity-50" />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <FileSearch className="h-5 w-5 text-primary" />
          </div>
          <span className="font-heading font-bold text-xl">RAGbox</span>
        </div>
        
        <div className="flex items-center gap-4">
          <a 
            href="/login" 
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Sign In
          </a>
          <a 
            href="#waitlist" 
            className="btn-cyber text-sm py-2"
          >
            Get Early Access
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section 
        className="relative z-10 px-6 py-20 lg:px-12 lg:py-32"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div 
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Pioneer Access Now Open</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            variants={fadeInUp}
            className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
          >
            Your Files Speak.
            <br />
            <span className="gradient-text">We Make Them Testify.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p 
            variants={fadeInUp}
            className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-8"
          >
            The SEC 17a-4 ready document intelligence vault for professionals 
            who can&apos;t afford to be wrong. Upload. Interrogate. Discover.
          </motion.p>

          {/* Trust Badges */}
          <motion.div 
            variants={fadeInUp}
            className="flex flex-wrap items-center justify-center gap-3 mb-12"
          >
            {trustBadges.map((badge) => (
              <span 
                key={badge}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-muted bg-border/50 rounded-full"
              >
                <CheckCircle2 className="h-3 w-3 text-primary" />
                {badge}
              </span>
            ))}
          </motion.div>

          {/* Waitlist Form */}
          <motion.div 
            id="waitlist"
            variants={fadeInUp}
            className="max-w-md mx-auto"
          >
            {!isSubmitted ? (
              <form onSubmit={handleWaitlistSubmit} className="flex gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 bg-black/50 border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-cyber whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Joining...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Join Pioneers
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-3 px-6 py-4 bg-primary/10 border border-primary/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-primary font-medium">
                  Welcome to the Pioneer list! Check your email.
                </span>
              </div>
            )}
            <p className="text-xs text-muted mt-3">
              Join 4,750+ legal and finance professionals. No spam, ever.
            </p>
          </motion.div>
        </div>

        {/* Hero Graphic - Animated Box */}
        <motion.div 
          variants={fadeInUp}
          className="relative max-w-2xl mx-auto mt-16 lg:mt-24"
        >
          <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-black/50 backdrop-blur-sm">
            {/* Wireframe Box Animation */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* The Box */}
                <motion.div
                  animate={{ 
                    rotateY: [0, 360],
                    rotateX: [0, 15, 0, -15, 0],
                  }}
                  transition={{ 
                    duration: 20, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                  className="w-32 h-32 md:w-48 md:h-48"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Cube faces */}
                  <div className="absolute inset-0 border-2 border-primary/30 bg-primary/5 transform -translate-z-16" />
                  <div className="absolute inset-0 border-2 border-primary/30 bg-primary/5 transform translate-z-16" />
                  <div className="absolute inset-0 border-2 border-primary/50 bg-primary/10 shadow-glow-cyan" />
                </motion.div>

                {/* Floating documents */}
                <motion.div
                  animate={{ 
                    y: [-20, 0],
                    opacity: [0, 1, 1, 0],
                    scale: [0.8, 1, 1, 0.5],
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                  className="absolute -top-16 left-1/2 -translate-x-1/2"
                >
                  <div className="w-8 h-10 bg-white/10 border border-white/20 rounded-sm flex items-center justify-center">
                    <div className="w-4 h-0.5 bg-white/30 rounded-full" />
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Light beam effect */}
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-48 bg-gradient-to-t from-primary/30 via-primary/10 to-transparent"
              style={{ clipPath: "polygon(20% 100%, 80% 100%, 60% 0%, 40% 0%)" }}
            />
          </div>

          {/* Glow effect behind */}
          <div className="absolute inset-0 -z-10 bg-primary/10 blur-3xl rounded-full transform scale-75" />
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Built for Industries That Can&apos;t Afford to Get It Wrong
            </h2>
            <p className="text-muted max-w-2xl mx-auto">
              Legal. Financial Services. Healthcare. Government. 
              If your industry has regulators watching, RAGbox was designed with you in mind.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="glass-card p-6 hover:shadow-glow-cyan transition-all duration-300 group"
              >
                <div className={`
                  w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-all duration-300
                  ${feature.color === "primary" ? "bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground" : ""}
                  ${feature.color === "warning" ? "bg-warning/20 text-warning group-hover:bg-warning group-hover:text-warning-foreground" : ""}
                  ${feature.color === "danger" ? "bg-danger/20 text-danger group-hover:bg-danger group-hover:text-danger-foreground" : ""}
                `}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 px-6 py-20 lg:px-12 bg-black/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Three Steps. No Training. No IT Project.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Upload", desc: "Feed your documents into the vault." },
              { step: "2", title: "Interrogate", desc: "Ask anything in plain English." },
              { step: "3", title: "Discover", desc: "Get answers with proof." },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center mx-auto mb-4">
                  <span className="font-heading text-2xl font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="font-heading text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Ready to Make Your Files Testify?
            </h2>
            <p className="text-muted mb-8">
              Join the Pioneer program and be among the first to experience 
              document intelligence that&apos;s built for compliance.
            </p>
            <a href="#waitlist" className="btn-cyber text-lg px-8 py-4">
              Join the Pioneer Access List
              <ArrowRight className="h-5 w-5 ml-2 inline" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-8 lg:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center">
              <FileSearch className="h-4 w-4 text-primary" />
            </div>
            <span className="font-heading font-bold">RAGbox</span>
            <span className="text-muted text-sm">by ConnexUS AI</span>
          </div>
          <div className="text-muted text-sm">
            © {new Date().getFullYear()} ConnexUS AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
