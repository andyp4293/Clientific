import ReviewSurveyExperience from '@/components/reviews/ReviewSurveyExperience';

export default async function FeedbackSurveyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ReviewSurveyExperience slug={slug} />;
}
