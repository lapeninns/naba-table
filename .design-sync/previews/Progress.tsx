import { Progress } from 'nabatable-platform';

export const CapacityLevels = () => (
  <div className="flex w-72 flex-col gap-4">
    <Progress value={25} />
    <Progress value={60} />
    <Progress value={92} />
  </div>
);
