import { Dialog as SheetPrimitive } from 'bits-ui';
import Description from '../dialog/dialog-description.svelte';
import Title from '../dialog/dialog-title.svelte';
import Content from './sheet-content.svelte';
import Footer from './sheet-footer.svelte';
import Header from './sheet-header.svelte';

const Root = SheetPrimitive.Root;
const Trigger = SheetPrimitive.Trigger;
const Close = SheetPrimitive.Close;

export {
  Root as Sheet,
  Close as SheetClose,
  Content as SheetContent,
  Description as SheetDescription,
  Footer as SheetFooter,
  Header as SheetHeader,
  Title as SheetTitle,
  Trigger as SheetTrigger
};
