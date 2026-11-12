import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Star } from 'lucide-react';
import { api } from '@/lib/api';

export function MenuRatingChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get('/rating/analytics');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch rating analytics', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-foreground text-sm sm:text-lg flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            Menu Ratings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center min-h-[250px]">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-foreground text-sm sm:text-lg flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          Menu Ratings Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-[250px]">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No rating data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(225,225,255,0.08)" />
              <XAxis dataKey="date" stroke="#74788F" fontSize={10} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
              <YAxis stroke="#74788F" fontSize={10} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#171928', border: '1px solid rgba(167,139,250,0.28)', borderRadius: '10px', color: '#F0EFF8' }}
                itemStyle={{ color: '#F0EFF8' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#9295AD' }} />
              <Bar dataKey="Breakfast" fill="#A78BFA" name="Breakfast" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Lunch" fill="#74DCCB" name="Lunch" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Snacks" fill="#818CF8" name="Snacks" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Dinner" fill="#ED91C1" name="Dinner" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
