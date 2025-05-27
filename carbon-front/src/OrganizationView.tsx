import {
    useSuiClientQuery,
    useCurrentAccount,
  } from "@mysten/dapp-kit";
  import { SuiObjectData } from "@mysten/sui/client";
  import { Button, Flex, Heading, Text, Card } from "@radix-ui/themes";
  
  interface OrganizationViewProps {
    id: string;
    onBack: () => void;
  }
  
  interface Organization {
    id: string;
    name: string;
    description: string;
    wallet_address: string;
    owner: string;
    carbon_credits: number;
    times_lent: number;
    total_lent: number;
    times_borrowed: number;
    total_borrowed: number;
    total_returned: number;
    times_returned: number;
    emissions: number;
    reputation_score: number;
  }
  
  export function OrganizationView({ id, onBack }: OrganizationViewProps) {
    const currentAccount = useCurrentAccount();
    const { data, isLoading, error } = useSuiClientQuery("getObject", {
      id,
      options: {
        showContent: true,
        showOwner: true,
      },
    });
  
    if (isLoading) return <Text>Loading organization data...</Text>;
    if (error) return <Text>Error loading organization: {error.message}</Text>;
  
    const org = data?.data ? getOrganizationFields(data.data) : null;
    const isOwner = org?.owner === currentAccount?.address;
  
    return (
      <Card>
        <Flex direction="column" gap="4">
          <Button variant="soft" onClick={onBack}>
            Back to Registration
          </Button>
  
          <Heading size="4">{org?.name}</Heading>
          <Text>{org?.description}</Text>
  
          <Flex gap="4" wrap="wrap">
            <Card>
              <Text weight="bold">Carbon Credits</Text>
              <Text size="5">{org?.carbon_credits}</Text>
            </Card>
            <Card>
              <Text weight="bold">Reputation Score</Text>
              <Text size="5">{org?.reputation_score}</Text>
            </Card>
            <Card>
              <Text weight="bold">Total Lent</Text>
              <Text size="5">{org?.total_lent}</Text>
            </Card>
          </Flex>
  
          {isOwner && (
            <Flex gap="2" mt="4">
              <Button>Manage Credits</Button>
              <Button variant="soft">Edit Profile</Button>
            </Flex>
          )}
        </Flex>
      </Card>
    );
  }
  
  function getOrganizationFields(data?: SuiObjectData): Organization | null {
    if (!data || data.content?.dataType !== "moveObject") return null;
    return data.content.fields as unknown as Organization;
  }