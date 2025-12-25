import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { 
  Target, 
  Users, 
  Clock, 
  Shield, 
  Zap,
  Heart,
  GraduationCap,
  Home,
  DollarSign,
  Building
} from 'lucide-react';

const trustStats = [
  { icon: Users, value: '100+', label: 'Students' },
  { icon: Clock, value: '24/7', label: 'Access' },
  { icon: Shield, value: 'Secure', label: 'Management' },
  { icon: Zap, value: 'Faster', label: 'Operations' },
];

const values = [
  {
    icon: Shield,
    title: 'Student Safety',
    description: 'Ensuring a secure living environment for all residents.',
  },
  {
    icon: Heart,
    title: 'Equal Facilities',
    description: 'Providing equal access to all amenities and services.',
  },
  {
    icon: GraduationCap,
    title: 'Education Support',
    description: 'Creating an environment conducive to academic success.',
  },
  {
    icon: DollarSign,
    title: 'Affordable Living',
    description: 'Maintaining reasonable costs without compromising quality.',
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-primary/5" />
          <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-8">
              <Target className="w-4 h-4" />
              <span>About Us</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Our Mission
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              We empower hostels to embrace the digital future by simplifying daily hostel operations at Q2 Hostel.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 bg-card/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Trusted by Students & Administrators
            </h2>
            <p className="text-muted-foreground text-lg">
              at Q2 Hostel
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {trustStats.map((stat, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl bg-card border border-border/50 text-center hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <stat.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                <div className="text-muted-foreground text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-info/5 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Built for Students.
                <span className="block text-primary">Managed with Care.</span>
              </h2>

              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Q2 Management directly improves hostel life, making administration simple and transparent for everyone involved.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Our system streamlines every aspect of hostel management, from room allocation to mess management, ensuring that both students and administrators can focus on what matters most – creating a comfortable and productive living environment.
              </p>
            </div>

            <div className="relative">
              <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-info/10 border border-border/50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-2xl bg-card/80 border border-border/30">
                    <Building className="w-8 h-8 text-primary mb-3" />
                    <div className="text-sm text-muted-foreground">Modern</div>
                    <div className="text-lg font-semibold text-foreground">Infrastructure</div>
                  </div>
                  <div className="p-6 rounded-2xl bg-card/80 border border-border/30">
                    <Users className="w-8 h-8 text-primary mb-3" />
                    <div className="text-sm text-muted-foreground">Dedicated</div>
                    <div className="text-lg font-semibold text-foreground">Support Team</div>
                  </div>
                  <div className="p-6 rounded-2xl bg-card/80 border border-border/30">
                    <Shield className="w-8 h-8 text-primary mb-3" />
                    <div className="text-sm text-muted-foreground">24/7</div>
                    <div className="text-lg font-semibold text-foreground">Security</div>
                  </div>
                  <div className="p-6 rounded-2xl bg-card/80 border border-border/30">
                    <Zap className="w-8 h-8 text-primary mb-3" />
                    <div className="text-sm text-muted-foreground">Quick</div>
                    <div className="text-lg font-semibold text-foreground">Response Time</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-card/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Our Values
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              The principles that guide everything we do at Q2 Hostel
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 group text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <value.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
