import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Utensils } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const mealTypes = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

export function MealRatingWidget() {
  const [selectedMeal, setSelectedMeal] = useState('Lunch');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a star rating');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post('/rating/submit', {
        mealType: selectedMeal,
        rating,
        feedback
      });

      if (response.data.success) {
        toast.success('Rating submitted! Thank you.');
        setRating(0);
        setFeedback('');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Utensils className="w-5 h-5 text-primary" />
          Rate Today's Meal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {mealTypes.map((meal) => (
            <Button
              key={meal}
              variant={selectedMeal === meal ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMeal(meal)}
              className={selectedMeal === meal ? 'bg-primary text-primary-foreground' : ''}
            >
              {meal}
            </Button>
          ))}
        </div>

        <div className="flex justify-center py-2 gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                "w-10 h-10 cursor-pointer transition-all",
                (hoverRating || rating) >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-amber-400/50"
              )}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            />
          ))}
        </div>

        <Textarea
          placeholder="Any feedback? (Optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="resize-none"
          rows={2}
        />

        <Button 
          className="w-full" 
          onClick={handleSubmit} 
          disabled={submitting || rating === 0}
        >
          {submitting ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </CardContent>
    </Card>
  );
}
