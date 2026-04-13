import React from 'react';
import { motion } from 'motion/react';
import { User, Truck, Package, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

interface OnboardingFlowProps {
  stats: {
    customers: number;
    drivers: number;
    loads: number;
  };
}

export function OnboardingFlow({ stats }: OnboardingFlowProps) {
  const steps = [
    {
      id: 'customer',
      title: 'Add Your First Customer',
      description: 'Define who you are delivering for and where they are located.',
      icon: User,
      href: '/customers',
      completed: stats.customers > 0,
      color: 'blue'
    },
    {
      id: 'driver',
      title: 'Register a Driver',
      description: 'Add drivers to your fleet to start assigning loads.',
      icon: Truck,
      href: '/drivers',
      completed: stats.drivers > 0,
      color: 'emerald'
    },
    {
      id: 'load',
      title: 'Create Your First Load',
      description: 'Set up a logistics task and dispatch it to a driver.',
      icon: Package,
      href: '/loads',
      completed: stats.loads > 0,
      color: 'amber'
    }
  ];

  const activeStepIndex = steps.findIndex(s => !s.completed);
  const currentStep = activeStepIndex === -1 ? null : steps[activeStepIndex];

  if (!currentStep && stats.loads > 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              Onboarding Progress
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {activeStepIndex === -1 ? 'Ready for Operations!' : 'Complete your setup'}
            </h2>
            <p className="text-gray-500 text-sm max-w-lg">
              Follow these steps to get your logistics network running in real-time.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {steps.map((step, idx) => (
              <div 
                key={step.id}
                className={cn(
                  "h-2 w-12 rounded-full transition-all duration-500",
                  step.completed ? "bg-emerald-500" : idx === activeStepIndex ? "bg-blue-600 shadow-sm" : "bg-gray-200"
                )}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === activeStepIndex;
            const isCompleted = step.completed;
            const isDisabled = idx > activeStepIndex && !isCompleted;

            return (
              <Link
                key={step.id}
                to={isDisabled ? '#' : step.href}
                className={cn(
                  "relative p-6 rounded-xl border transition-all group",
                  isActive 
                    ? "border-blue-200 bg-blue-50/50 ring-2 ring-blue-500 ring-offset-2" 
                    : isCompleted 
                      ? "border-emerald-100 bg-emerald-50/30" 
                      : "border-gray-100 bg-gray-50/50 opacity-60 grayscale cursor-not-allowed"
                )}
                onClick={(e) => isDisabled && e.preventDefault()}
              >
                {isCompleted && (
                  <div className="absolute top-4 right-4 text-emerald-600">
                    <CheckCircle2 size={20} />
                  </div>
                )}
                
                <div className={cn(
                  "h-12 w-12 rounded-lg flex items-center justify-center mb-4 transition-colors",
                  isCompleted 
                    ? "bg-emerald-100 text-emerald-600" 
                    : isActive 
                      ? "bg-blue-100 text-blue-600" 
                      : "bg-gray-200 text-gray-400"
                )}>
                  <Icon size={24} />
                </div>

                <h3 className={cn(
                  "font-bold mb-1",
                  isCompleted ? "text-emerald-900" : isActive ? "text-blue-900" : "text-gray-500"
                )}>
                  {step.title}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {step.description}
                </p>

                {isActive && (
                  <div className="mt-4 flex items-center text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                    Get Started <ArrowRight size={14} className="ml-1" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
