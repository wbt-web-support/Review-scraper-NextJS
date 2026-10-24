import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import Layout from "../components/Layout";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Loader2 } from "lucide-react";

interface IUser { 
  _id: string; 
  username: string;
  email: string;
  fullName?: string;
}

interface ProfileUpdateResponse {
  message: string;
  user: IUser;
}

interface PasswordChangeResponse { 
  message: string;
}

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters long."),
  email: z.string().email("Please enter a valid email address."),
  username: z.string().min(3, "Username must be at least 3 characters long."),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters long."),
  confirmPassword: z.string().min(6, "Please confirm your new password.")
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type SettingsTab = "profile" | "password" | "api";

const Settings = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { status: authStatus } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') {
      router.push('/login?callbackUrl=/settings');
    }
  }, [authStatus, router]);

  const { data: userData, isLoading } = useQuery<IUser>({
    queryKey: ['authUser'],
    queryFn: () => apiRequest<IUser>("GET", '/api/auth/user'),
    enabled: authStatus === 'authenticated',
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", email: "", username: "" },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (userData) {
      profileForm.reset({
        fullName: userData?.fullName ?? "",
        email: userData.email || "", 
        username: userData.username || "",
      });
    }
  }, [userData, profileForm]);

  const updateProfileMutation = useMutation<ProfileUpdateResponse, Error, ProfileFormData>({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest<ProfileUpdateResponse>("PUT", "/api/auth/profile", data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['authUser'] });
      toast({ title: "Profile Updated", description: data.message || "Your profile has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update profile.", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation<PasswordChangeResponse, Error, PasswordFormData>({
    mutationFn: async (data: PasswordFormData): Promise<PasswordChangeResponse> => {
        const { confirmPassword, ...payload } = data; 
        const response = await apiRequest<PasswordChangeResponse>("PUT", "/api/auth/password", payload);
        return response;
    },
    onSuccess: (data) => {
      passwordForm.reset();
      toast({ title: "Password Changed", description: data.message || "Your password has been changed successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Change Failed", description: error.message || "Failed to change password.", variant: "destructive" });
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  if (authStatus === 'loading' || authStatus === 'unauthenticated') {
    return <Layout><div className="flex justify-center items-center h-screen"><p>Loading settings...</p></div></Layout>;
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-gray-800 dark:text-white mb-1">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="max-w-2xl">
        <Tabs defaultValue="profile" value={activeTab} onValueChange={(value: unknown) => setActiveTab(value as SettingsTab)}>
          <TabsList className="mb-6 grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="api">API Keys</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Manage your personal information
                </CardDescription>
              </CardHeader>
              <CardContent>
              {isLoading ? (
                  <div className="space-y-4"> 
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-10 bg-primary-200 dark:bg-primary-700 rounded animate-pulse w-24 mt-2"></div>
                  </div>
                ) : (
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                      <FormField control={profileForm.control} name="fullName" render={({ field }) => ( <FormItem> <FormLabel>Full Name</FormLabel> <FormControl><Input placeholder="Your full name" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={profileForm.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Email</FormLabel> <FormControl><Input type="email" placeholder="your.email@example.com" {...field} disabled /></FormControl> <FormMessage /> <p className="text-xs text-muted-foreground pt-1">Email cannot be changed.</p> </FormItem> )} />
                      <FormField control={profileForm.control} name="username" render={({ field }) => ( <FormItem> <FormLabel>Username</FormLabel> <FormControl><Input placeholder="Your unique username" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                      <Button type="submit" className="mt-4" disabled={updateProfileMutation.isPending || !profileForm.formState.isDirty}>
                        {updateProfileMutation.isPending ? (<><Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />Saving...</>) : "Save Changes"}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Choose a new strong password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => ( <FormItem> <FormLabel>Current Password</FormLabel> <FormControl><Input type="password" placeholder="Enter your current password" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={passwordForm.control} name="newPassword" render={({ field }) => ( <FormItem> <FormLabel>New Password</FormLabel> <FormControl><Input type="password" placeholder="Enter new password" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => ( <FormItem> <FormLabel>Confirm New Password</FormLabel> <FormControl><Input type="password" placeholder="Confirm new password" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <Button type="submit" className="mt-4" disabled={changePasswordMutation.isPending}>
                      {changePasswordMutation.isPending ? (<><Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />Changing...</>) : "Change Password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API keys</CardTitle>
                <CardDescription>
                  Each business has its own key for the reviews API, so one client&apos;s key never works for another.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>To create, copy, regenerate or revoke a key, open the business&apos;s widget in <b>My Widgets</b> and go to the <b>Embed Code</b> tab.</p>
                <p>The Apify key used for crawling is set on the server and is not shown here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
