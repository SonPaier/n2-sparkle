import { useParams } from 'react-router-dom';
import PublicProtocolCustomerView from '@/components/protocols/PublicProtocolCustomerView';

const PublicProtocolView = () => {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Nieprawidłowy link do protokołu</p>
      </div>
    );
  }

  return <PublicProtocolCustomerView token={token} />;
};

export default PublicProtocolView;
