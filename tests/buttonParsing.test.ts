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

for (const label of ["Run It", "", "Add+More", "Add+(Test)[One]?"]) {
  test(`selects each duplicate caption ${JSON.stringify(label)}`, () => {
    const text = `{{${label}:SmartBlock:First:RemoveButton=false}} {{${label}:42SmartBlock:Second:Icon=locate}}`;
    expect(parseSmartBlockButton(label, text, 0)).toMatchObject({
      workflowName: "First",
      variables: { RemoveButton: "false", ButtonContent: label },
    });
    expect(parseSmartBlockButton(label, text, 1)).toMatchObject({
      workflowName: "Second",
      variables: { Icon: "locate", ButtonContent: label },
    });
  });
}

test("rejects invalid occurrence indices", () => {
  for (const index of [-1, 2, NaN, Infinity, 0.5])
    expect(
      parseSmartBlockButton("b", "{{b:SmartBlock:Only}}", index)
    ).toBeNull();
});
for (const prefix of [
  "`{{b}}`",
  "`{{b:SmartBlock:Hidden}}`",
  "```\n{{b}}\n```",
  "````{{b}}````",
  "`````{{b}}`````",
  "`unterminated",
]) {
  test(`ignores only rendered code literals: ${prefix}`, () => {
    const first = "{{b:SmartBlock:First}}",
      second = "{{b:SmartBlock:Second}}";
    const text = prefix + " " + first + " " + second;
    expect(parseSmartBlockButton("b", text, 0)?.workflowName).toBe("First");
    expect(parseSmartBlockButton("b", text, 1)?.index).toBe(
      text.indexOf(second)
    );
  });
}
for (const generic of [
  "{{b}}",
  "{{ b }}",
  "{{[[b]]}}",
  "{{b:Other:ignored}}",
  "{{a/b}}",
]) {
  test(`reserves the native macro position: ${generic}`, () => {
    const text =
      generic + " {{ b :SmartBlock:First}} {{[[b]]:SmartBlock:Second}}";
    expect(parseSmartBlockButton("b", text, 0)).toBeNull();
    expect(parseSmartBlockButton("b", text, 1)?.workflowName).toBe("First");
    expect(parseSmartBlockButton("b", text, 2)?.workflowName).toBe("Second");
  });
}
test("preserves raw offsets while normalizing captions and whitespace", () => {
  const full = "{{ [[Run  It]] :SmartBlock:First:Value={x}}}";
  const parsed = parseSmartBlockButton("Run It", "😀 " + full);
  expect(parsed?.index).toBe(3);
  expect(parsed?.full).toBe(full);
  expect(parsed?.variables).toMatchObject({
    Value: "{x}",
    ButtonContent: "Run It",
  });
  expect(parseSmartBlockButton("b", "{{b:SmartBlock:`literal`}}")).toBeNull();
});
