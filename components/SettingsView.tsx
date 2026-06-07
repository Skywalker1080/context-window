import { motion } from "framer-motion";
import { User, Bell, Shield, Palette, LogOut, ChevronRight, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function SettingsView() {
  const { user, signOut } = useAuth();
  const isGoogleUser = user?.provider === "google";
  const userInitial = (
    user?.displayName?.trim()?.[0] ??
    user?.email?.trim()?.[0] ??
    "U"
  ).toUpperCase();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-violet-soft flex items-center justify-center flex-shrink-0">
          <Settings size={18} className="text-accent-violet" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Settings
          </h2>
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
            Manage your account
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Account Section */}
        <motion.section variants={itemVariants} className="space-y-2">
          <h3 className="text-[11px] font-semibold text-text-ghost uppercase tracking-wider pl-1">
            Account
          </h3>
          <div className="glass-strong rounded-xl border border-border-subtle overflow-hidden">
            <div className="p-3 sm:p-4 flex items-center gap-3 border-b border-border-subtle bg-surface-raised/10">
              {isGoogleUser && user?.photoURL ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-10 h-10 rounded-lg object-cover ring-1 ring-border-subtle"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-accent-violet-soft flex items-center justify-center ring-1 ring-border-subtle">
                  <span className="text-lg font-bold text-accent-violet">
                    {userInitial}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-text-primary truncate">
                  {user?.displayName || "User"}
                </h4>
                <p className="text-xs text-text-secondary truncate">
                  {user?.email || "No email provided"}
                </p>
              </div>
            </div>
            
            <div className="divide-y divide-border-subtle">
              <button className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-surface-raised/30 transition-colors text-left group">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-surface-overlay text-text-muted group-hover:text-accent-violet transition-colors">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">Personal Information</p>
                    <p className="text-[10px] text-text-ghost">Update your name and profile details</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-text-ghost group-hover:text-text-primary transition-colors" />
              </button>
              
              <button className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-surface-raised/30 transition-colors text-left group">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-surface-overlay text-text-muted group-hover:text-accent-cyan transition-colors">
                    <Shield size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">Security</p>
                    <p className="text-[10px] text-text-ghost">Password, 2FA, and linked accounts</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-text-ghost group-hover:text-text-primary transition-colors" />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Preferences Section */}
        <motion.section variants={itemVariants} className="space-y-2">
          <h3 className="text-[11px] font-semibold text-text-ghost uppercase tracking-wider pl-1">
            Preferences
          </h3>
          <div className="glass-strong rounded-xl border border-border-subtle overflow-hidden divide-y divide-border-subtle">
            <button className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-surface-raised/30 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-surface-overlay text-text-muted group-hover:text-accent-emerald transition-colors">
                  <Palette size={16} />
                </div>
                <div>
                  <p className="text-xs font-medium text-text-primary">Appearance</p>
                  <p className="text-[10px] text-text-ghost">Dark mode is currently active</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-text-ghost group-hover:text-text-primary transition-colors" />
            </button>
            
            <button className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-surface-raised/30 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-surface-overlay text-text-muted group-hover:text-accent-amber transition-colors">
                  <Bell size={16} />
                </div>
                <div>
                  <p className="text-xs font-medium text-text-primary">Notifications</p>
                  <p className="text-[10px] text-text-ghost">Email summaries and alerts</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-text-ghost group-hover:text-text-primary transition-colors" />
            </button>
          </div>
        </motion.section>

        {/* Danger Zone */}
        <motion.section variants={itemVariants} className="pt-2">
          <button
            onClick={signOut}
            className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl
                       text-accent-rose text-xs font-medium bg-accent-rose-soft/30 border border-accent-rose/20
                       hover:bg-accent-rose-soft hover:border-accent-rose/40 transition-all"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </motion.section>
      </div>
    </motion.div>
  );
}
