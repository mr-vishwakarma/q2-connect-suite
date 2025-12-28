import { motion } from 'framer-motion';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import { User } from 'lucide-react';

const teamMembers = [
  {
    name: 'Mr. Abhigyanam Giri',
    role: 'Owner – All Hostels',
    description: 'Founder and owner of all Q2 hostel branches',
  },
  {
    name: 'Mr. Karan',
    role: 'Web App Developer',
    description: 'Developed Adda Mess Management System & Q2 Hostel Management System',
  },
  {
    name: 'Deepak Kumar Giri',
    role: 'Manager – Q2.0 Hostel',
    description: 'Managing operations at Q2.0 Hostel',
  },
  {
    name: 'Abhijeet Giri',
    role: 'Manager – Q2.1 Hostel',
    description: 'Managing operations at Q2.1 Hostel',
  },
];

export default function OurTeam() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
      <Navbar />
      
      <BuildingBackground showOnHome={true} />
      
      <main className="flex-1 pt-32 pb-20 px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Meet Our Team!
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              The dedicated people behind Q2 Hostel Management System
            </p>
          </motion.div>

          {/* Team Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group"
              >
                <div className="bg-card border border-border rounded-2xl p-6 text-center h-full transition-all duration-300 hover:border-primary/50 hover:shadow-lg"
                  style={{ boxShadow: '0 4px 24px hsl(0 0% 0% / 0.2)' }}
                >
                  {/* Avatar */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-24 h-24 mx-auto mb-4 rounded-full border-4 border-primary/50 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:border-primary transition-colors"
                    style={{ boxShadow: '0 0 30px hsl(217 91% 50% / 0.3)' }}
                  >
                    <User className="w-12 h-12 text-primary/70 group-hover:text-primary transition-colors" />
                  </motion.div>

                  {/* Name */}
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    {member.name}
                  </h3>

                  {/* Role */}
                  <p className="text-primary text-sm font-medium mb-3">
                    {member.role}
                  </p>

                  {/* Description */}
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {member.description}
                  </p>

                  {/* View Profile Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-all hover:bg-primary/90"
                    style={{ boxShadow: '0 0 20px hsl(217 91% 50% / 0.3)' }}
                  >
                    View Profile
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
