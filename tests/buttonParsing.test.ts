import { test, expect } from "@playwright/test";
import parseSmartBlockButton from "../src/utils/parseSmartBlockButton";

test("parses SmartBlock button without label", () => {
  const text = "{{:SmartBlock:deleteBlock:Icon=locate}}";
  const result = parseSmartBlockButton("", text);
  expect(result).toBeTruthy();
  expect(result?.index).toBe(0);
  expect(result?.full).toBe(text);
  expect(result?.buttonContent).toBe("");
  expect(result?.buttonText).toBe("deleteBlock:Icon=locate");
  expect(result?.variables).toMatchObject({
    Icon: "locate",
    ButtonContent: "",
  });
});

test("parses SmartBlock button with variables", () => {
  const text =
    "{{randomChild:SmartBlock:randomChild:RemoveButton=false,Order=<%RANDOMNUMBER:1,10%>}}";
  const result = parseSmartBlockButton("randomChild", text);
  expect(result).toBeTruthy();
  expect(result?.index).toBe(0);
  expect(result?.full).toBe(text);
  expect(result?.buttonContent).toBe("randomChild");
  expect(result?.buttonText).toBe(
    "randomChild:RemoveButton=false,Order=<%RANDOMNUMBER:1,10%>"
  );
  expect(result?.variables).toMatchObject({
    RemoveButton: "false",
    Order: "<%RANDOMNUMBER:1,10%>",
    ButtonContent: "randomChild",
  });
});

test("parses SmartBlock button with workflow containing spaces", () => {
  const text =
    "{{Add New Meeting Entry:SmartBlock:1on1 Meeting - Date Select:RemoveButton=false}}";
  const result = parseSmartBlockButton("Add New Meeting Entry", text);
  expect(result).toBeTruthy();
  expect(result?.workflowName).toBe("1on1 Meeting - Date Select");
  expect(result?.variables).toMatchObject({
    RemoveButton: "false",
    ButtonContent: "Add New Meeting Entry",
  });
});

test("parses SmartBlock button with sibling directive", () => {
  const text =
    "{{testSibling:SmartBlock:testSibling:Sibling=next,RemoveButton=false}}";
  const result = parseSmartBlockButton("testSibling", text);
  expect(result?.variables).toMatchObject({
    Sibling: "next",
    RemoveButton: "false",
    ButtonContent: "testSibling",
  });
});

test("parses SmartBlock button for today's entry", () => {
  const text = `{{Create Today's Entry:SmartBlock:UserDNPToday:RemoveButton=false}}`;
  const result = parseSmartBlockButton("Create Today's Entry", text);
  expect(result?.workflowName).toBe("UserDNPToday");
  expect(result?.variables).toMatchObject({
    RemoveButton: "false",
    ButtonContent: "Create Today's Entry",
  });
});

test("parses multiple labeled SmartBlock buttons in the same block", () => {
  const text =
    "{{Run It:SmartBlock:WorkflowOne:RemoveButton=false}} and {{Run It:SmartBlock:WorkflowTwo:Icon=locate,Order=last}}";
  const first = parseSmartBlockButton("Run It", text, 0);
  const second = parseSmartBlockButton("Run It", text, 1);
  expect(first?.workflowName).toBe("WorkflowOne");
  expect(first?.variables).toMatchObject({
    RemoveButton: "false",
    ButtonContent: "Run It",
  });
  expect(second?.workflowName).toBe("WorkflowTwo");
  expect(second?.variables).toMatchObject({
    Icon: "locate",
    Order: "last",
    ButtonContent: "Run It",
  });
});

test("parses multiple unlabeled SmartBlock buttons in the same block", () => {
  const text =
    "{{:SmartBlock:first:Icon=locate}} and {{:SmartBlock:second:RemoveButton=false}}";
  const first = parseSmartBlockButton("", text, 0);
  const second = parseSmartBlockButton("", text, 1);
  expect(first?.buttonText).toBe("first:Icon=locate");
  expect(first?.variables).toMatchObject({
    Icon: "locate",
    ButtonContent: "",
  });
  expect(second?.buttonText).toBe("second:RemoveButton=false");
  expect(second?.variables).toMatchObject({
    RemoveButton: "false",
    ButtonContent: "",
  });
});

test("returns null when occurrence index is out of bounds", () => {
  const text = "{{Only One:SmartBlock:Workflow}}";
  const result = parseSmartBlockButton("Only One", text, 2);
  expect(result).toBeNull();
});

test("parses SmartBlock button label containing plus signs", () => {
  const text = "{{Add+More:SmartBlock:PlusWorkflow}}";
  const result = parseSmartBlockButton("Add+More", text);
  expect(result?.workflowName).toBe("PlusWorkflow");
  expect(result?.variables).toMatchObject({
    ButtonContent: "Add+More",
  });
});
