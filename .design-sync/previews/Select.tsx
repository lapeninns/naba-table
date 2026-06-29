import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel,
} from 'nabatable-platform';

export const PartySize = () => (
  <Select defaultOpen defaultValue="4">
    <SelectTrigger className="w-56">
      <SelectValue placeholder="Party size" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Party size</SelectLabel>
        <SelectItem value="2">2 guests</SelectItem>
        <SelectItem value="4">4 guests</SelectItem>
        <SelectItem value="6">6 guests</SelectItem>
        <SelectItem value="8">8 guests</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);
