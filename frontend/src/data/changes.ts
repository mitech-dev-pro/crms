import type { ChangeRequest } from "@/types/change";

export const changeRequests: ChangeRequest[] = [
  {
    id: 1,
    title: "Upgrade Claims Management System",
    description: "Upgrade the existing claims management system.",
    priority: "High",
    status: "Pending",
    requester: "John Doe",
  },
  {
    id: 2,
    title: "Implement New Reporting Feature",
    description: "Add a new reporting feature.",
    priority: "Medium",
    status: "In Progress",
    requester: "Jane Smith",
  },
  {
    id: 3,
    title: "Fix Security Vulnerability",
    description: "Address the identified security vulnerability.",
    priority: "High",
    status: "Pending",
    requester: "Alice Johnson",
  },
  {
    id: 4,
    title: "Update User Interface",
    description: "Improve the application user interface.",
    priority: "Low",
    status: "Completed",
    requester: "Bob Brown",
  },
];