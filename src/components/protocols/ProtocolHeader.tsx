interface ProtocolHeaderProps {
  instanceName: string;
  logoUrl: string | null;
}

const ProtocolHeader = ({ instanceName, logoUrl }: ProtocolHeaderProps) => {
  return (
    <div className="flex items-center gap-4">
      {logoUrl && (
        <img src={logoUrl} alt={instanceName} className="h-12 w-auto object-contain" />
      )}
      <div>
        <h1 className="text-lg font-bold text-foreground">{instanceName}</h1>
        <p className="text-sm text-muted-foreground">Protokół</p>
      </div>
    </div>
  );
};

export default ProtocolHeader;
