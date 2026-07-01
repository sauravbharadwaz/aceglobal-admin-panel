import { getExperts, getReviews } from "@/lib/data";
import { ReviewsTable } from "@/components/reviews/reviews-table";

export const dynamic = "force-dynamic";

export default async function ExpertReviewsPage() {
  const [reviews, experts] = await Promise.all([getReviews(), getExperts()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expert Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Client ratings and feedback on your experts.
        </p>
      </div>
      <ReviewsTable reviews={reviews} expertNames={experts.map((e) => e.name)} />
    </div>
  );
}
