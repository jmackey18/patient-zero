import type { Scenario, Snapshot } from './contracts';

/**
 * Builds fresh demo records for a scenario without running detection.
 * Passing null keeps residents but clears campaigns, messages, and warnings.
 */
export function createMockSnapshot(scenario: Scenario | null): Snapshot {
  // Mock data
  const residents = [
    { id: 'r1', displayName: 'Alex', persona: 'Student', isSimulated: true },
    {
      id: 'r2',
      displayName: 'Sam',
      persona: 'Small-business owner',
      isSimulated: true,
    },
    {
      id: 'r3',
      displayName: 'Jordan',
      persona: 'Grandparent',
      isSimulated: true,
    },
    { id: 'r4', displayName: 'Taylor', persona: 'Student', isSimulated: true },
  ];

  if (!scenario)
    return { residents, campaigns: [], messages: [], warnings: [] };

  const suspicious = scenario === 'suspicious';
  const clusterId = suspicious ? 'cluster-demo-1' : 'cluster-demo-2';
  const time = Date.UTC(2026, 10, 7, 18, 0);

  return {
    residents,
    campaigns: [
      {
        clusterId,
        label: suspicious
          ? 'Delivery-themed cluster'
          : 'Community newsletter cluster',
        detectionStatus: suspicious ? 'flagged' : 'monitoring',
        investigationStatus: 'not_requested',
      },
    ],
    messages: residents.slice(0, 3).map((resident, index) => ({
      id: `message-${index}`,
      recipientId: resident.id,
      detectedClusterId: clusterId,
      senderLabel: suspicious
        ? 'Unknown sender (synthetic)'
        : 'Avon newsletter (synthetic)',
      syntheticText: suspicious
        ? '[Synthetic example] Your parcel is on hold. Please verify your delivery details.'
        : '[Synthetic example] The Avon community picnic is Saturday. Everyone is welcome!',
      receivedAt: time + index * 1000,
    })),
    warnings: suspicious
      ? residents.slice(0, 2).map((resident, index) => ({
          id: `warning-${index}`,
          recipientId: resident.id,
          clusterId,
          severity: 'preliminary',
          warningText:
            'Similar messages have been flagged in this mock campaign. Avoid unverified links and check delivery details through the carrier’s official app or website. This is a preliminary assessment, not proof of a scam.',
          createdAt: time + 10000,
          acknowledged: false,
        }))
      : [],
  };
}
