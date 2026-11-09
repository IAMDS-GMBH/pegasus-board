import { defaultRolePayloads } from "@kaneo/permissions";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { CustomRoleEditor, PermissionList } from "./roles";

const m = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/hooks/mutations/workspace/use-update-workspace-role", () => ({
  default: () => ({ mutateAsync: m.update, isPending: false }),
}));
vi.mock("@/hooks/mutations/workspace/use-create-workspace-role", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/mutations/workspace/use-delete-workspace-role", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/queries/workspace/use-workspace-roles", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({}),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  m.update.mockResolvedValue({ success: true });
});

describe("workspace role permission editing", () => {
  it("shows role administration, membership and invitations in read-only role details", () => {
    render(<PermissionList permissions={defaultRolePayloads.admin} readOnly />);
    for (const label of [
      "Change role permissions",
      "Change member roles",
      "Invite members",
      "Edit teams",
    ]) {
      expect(screen.getByRole("switch", { name: label })).toBeChecked();
      expect(screen.getByRole("switch", { name: label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
  });
  it("can remove every permission, including all provider administrative rights", async () => {
    render(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{
          id: "role",
          workspaceId: "workspace",
          role: "admin",
          permission: defaultRolePayloads.admin,
          assignedOnly: false,
          createdAt: new Date(),
        }}
        isDefault
        onDelete={() => {}}
      />,
    );
    for (const control of screen.getAllByRole("switch", { checked: true }))
      fireEvent.click(control);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceRoles.saveChanges",
      }),
    );
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        workspaceId: "workspace",
        roleName: "admin",
        permission: {},
        assignedOnly: false,
      }),
    );
  });
  it("saves the assigned-only restriction as its own field, not as a permission", async () => {
    render(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{
          id: "role",
          workspaceId: "workspace",
          role: "fuehrungskraft",
          permission: { task: ["read", "update"] },
          assignedOnly: false,
          createdAt: new Date(),
        }}
        onDelete={() => {}}
      />,
    );
    const restriction = screen.getByRole("switch", {
      name: "Only assigned tasks",
    });
    expect(restriction).not.toBeChecked();
    fireEvent.click(restriction);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceRoles.saveChanges",
      }),
    );
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        workspaceId: "workspace",
        roleName: "fuehrungskraft",
        permission: { task: ["read", "update"] },
        assignedOnly: true,
      }),
    );
  });
  it("shows a stored assigned-only restriction as switched on", () => {
    render(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{
          id: "role",
          workspaceId: "workspace",
          role: "fuehrungskraft",
          permission: { task: ["read"] },
          assignedOnly: true,
          createdAt: new Date(),
        }}
        onDelete={() => {}}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "Only assigned tasks" }),
    ).toBeChecked();
  });
  // Pegasus fork (PEGA-142): the Hub's visibility and rights apply to every
  // member of a workspace it manages, so the role editor has no switch for
  // them and says where they come from.
  it("offers no Hub switch and explains that the Hub decides on leads", () => {
    render(
      <PermissionList
        permissions={{ task: ["read", "update"] }}
        selected={{ task: new Set(["read"]) }}
        onToggle={() => {}}
      />,
    );
    expect(
      screen.queryByRole("switch", { name: "Visibility from the Hub (units)" }),
    ).toBeNull();
    expect(
      screen.getByText(/In workspaces the Pegasus Hub manages/),
    ).toBeInTheDocument();
  });
  it("saves a role without a Hub field", async () => {
    render(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{
          id: "role",
          workspaceId: "workspace",
          role: "pegasus",
          permission: { task: ["read", "update"] },
          assignedOnly: false,
          createdAt: new Date(),
        }}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Only assigned tasks" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceRoles.saveChanges",
      }),
    );
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        workspaceId: "workspace",
        roleName: "pegasus",
        permission: { task: ["read", "update"] },
        assignedOnly: true,
      }),
    );
  });
  it("also exposes unknown stored permission entries instead of silently retaining them", () => {
    render(
      <PermissionList
        permissions={{ extension: ["future-right"] }}
        selected={{ extension: new Set(["future-right"]) }}
        onToggle={() => {}}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "future-right extension" }),
    ).toBeChecked();
  });
});
