import { redirect } from 'next/navigation';

interface Props {
  params: { id: string };
}

export default function ParentTopupRedirect({ params }: Props) {
  redirect(`/tuition/pay/${params.id}?renewal=true`);
}
